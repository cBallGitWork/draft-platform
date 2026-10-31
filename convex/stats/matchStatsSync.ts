import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, type ActionCtx } from "../_generated/server";
import { codesByOpta, fixtureCodeIn, namedMen } from "../football/feedIds";
import { logFailure, outcomeOf } from "../shared/errors";
import { readFplPayloads } from "../football/fpl/fpl";
import { fplStatLines, readFplLive, type FplStatLine } from "../football/fpl/fplLive";
import { matchRecords } from "./matchRecords";
import type { matchWrites } from "./matchStats";
import { byGameweek, type DueMatch } from "../shared/dueMatches";
import { matchSlots, plStatLines } from "../football/premierLeague/plMatch";
import { PL_FULL_TIME, readPlFixture, readPlFixtures, readPlPlayerStats, type RawPlFixture } from "../football/premierLeague/premierLeague";
import { matchStatsSyncFields, syncTrigger, type matchSyncOutcome } from "../schema";
import { writeScores } from "../football/matchScores";
import { plScoreRead, readEach, type ScoreReads } from "../football/scoreReads";
import { commentaryContext, delayCommentary, syncCommentary } from "../football/matchCommentary";
import { syncTeamStats } from "../football/matchTeamStats";
import { recordSideMatches, type SideMatches, type SideMatchOutcome } from "../admin/sideRuns";

// Issue #27: every due match's stats from both feeds, one record per named man, upserted with
// `matchStats.upsertMatch`. `crons.ts` runs it every 10 minutes (ARCHITECTURE.md); by hand from
// the CLI: `npx convex run stats/matchStatsSync:run '{"trigger":"manual"}'`, then `stats/matchStats:latest`.

type Outcome = Infer<typeof matchStatsSyncFields.outcome>;
type MatchOutcome = Infer<typeof matchSyncOutcome>;

/** What every due match of one gameweek is read against. */
interface GameweekReads {
  gameweek: number;
  codeByOpta: Map<string, number>;
  fplLines: FplStatLine[];
  /** The Premier League's list for the gameweek, by FPL's fixture code. */
  listed: Map<number | null, RawPlFixture>;
  /** Each match's clock as the list reads it, for the threshold lines' "~58'" (#44); a match the
   *  list gives no score for is absent, its problem on the run row. */
  clocks: Map<number, number | null>;
}

export const run = internalAction({
  args: { trigger: syncTrigger },
  returns: v.null(),
  handler: async (ctx, { trigger }) => {
    const ranAt = Date.now();
    let teamStats: SideMatchOutcome[] = [];
    const outcome: Outcome = await outcomeOf("match stats sync failed", async () => {
      const due: DueMatch[] = await ctx.runQuery(internal.stats.matchStats.due, { now: ranAt });
      if (due.length === 0) return { ok: true as const, matches: [], waiting: [] };
      const { sides, ...read } = await syncDue(ctx, due, ranAt, "wait");
      teamStats = sides.teamStats;
      return { ok: true as const, ...read };
    });
    await ctx.runMutation(internal.stats.matchStats.record, { trigger, ranAt, outcome });
    // Only its full-time reads read team stats, and the feed owes none between matches.
    await recordSideMatches(ctx, ranAt, { teamStats }, false);
    return null;
  },
});

/** What a read does with a match the Premier League does not yet call full time: the sync leaves
 *  it "waiting" for a later run; the live tick (#28) writes it, provisional. */
export type BeforeFullTime = "wait" | "live";

/** Each due match a gameweek at a time, since FPL's live stats and the Premier League's list come
 *  by gameweek. A gameweek whose reads fail fails each of its matches; a match that fails fails alone.
 *  `fpl` reads FPL's bootstrap and fixtures, which the live tick shares with the sheets' read. */
export async function syncDue(
  ctx: ActionCtx,
  due: DueMatch[],
  readAt: number,
  beforeFullTime: BeforeFullTime,
  fpl: typeof readFplPayloads = readFplPayloads,
) {
  const { bootstrap, fixtures } = await fpl();
  const codeByOpta = codesByOpta(bootstrap.elements);
  // The live tick reads each match's commentary too (#43), after its points and apart from them.
  const commentary = beforeFullTime === "live" ? commentaryContext(bootstrap, codeByOpta) : null;
  const matches: MatchOutcome[] = [];
  const waiting: number[] = [];
  const scores: ScoreReads = { reads: [], problems: [] };
  const sides: SideMatches = { teamStats: [], thresholdSteps: [] };
  for (const [gameweek, codes] of byGameweek(due)) {
    let reads: GameweekReads;
    try {
      const [live, round] = await Promise.all([readFplLive(gameweek), readPlFixtures(gameweek)]);
      const fplLines = fplStatLines(live, bootstrap.elements, fixtures);
      const listed = new Map(round.map((each) => [fixtureCodeIn(each), each]));
      const scored = dueScores(listed, codes);
      reads = { gameweek, codeByOpta, fplLines, listed, clocks: new Map(scored.reads.map((read) => [read.fixtureCode, read.minutes])) };
      scores.reads.push(...scored.reads);
      scores.problems.push(...scored.problems);
    } catch (error: unknown) {
      const message = logFailure(`gameweek ${gameweek}'s reads failed`, error);
      matches.push(...codes.map((fixtureCode) => ({ fixtureCode, ok: false as const, error: message })));
      if (commentary !== null) await delayCommentary(ctx, codes, message, readAt);
      continue;
    }
    for (const fixtureCode of codes) {
      try {
        const synced = await syncMatch(ctx, fixtureCode, reads, readAt, beforeFullTime);
        if (synced === null) waiting.push(fixtureCode);
        else {
          matches.push(synced.outcome);
          if (synced.thresholdSteps !== null) sides.thresholdSteps.push(synced.thresholdSteps);
        }
      } catch (error: unknown) {
        matches.push({ fixtureCode, ok: false, error: logFailure(`match ${fixtureCode} failed`, error) });
      }
      const listed = reads.listed.get(fixtureCode);
      if (commentary !== null) await syncCommentary(ctx, fixtureCode, listed, commentary, readAt);
      // Its five team stats (#45) while it is live, and at full time, apart from its points.
      if (beforeFullTime === "live" || listed?.status === PL_FULL_TIME) sides.teamStats.push(await syncTeamStats(ctx, fixtureCode, listed));
    }
  }
  return { matches, waiting, scores: await writeDueScores(ctx, readAt, scores), sides };
}

/** The due matches' scores written; a failed write fails each read's score on the run row, not
 *  the run, whose matches are already saved. */
async function writeDueScores(ctx: ActionCtx, readAt: number, scores: ScoreReads) {
  try {
    return await writeScores(ctx, "pl", readAt, scores);
  } catch (error: unknown) {
    const problem = logFailure("writing the due matches' scores failed", error);
    const unwritten = scores.reads.map(({ fixtureCode }) => ({ fixtureCode, problem }));
    return { received: scores.reads.length + scores.problems.length, written: 0, problems: [...scores.problems, ...unwritten] };
  }
}

/** Each due match's score from the Premier League's list. One the list leaves out is `syncMatch`'s
 *  to fail. */
function dueScores(listed: GameweekReads["listed"], codes: number[]): ScoreReads {
  const found = codes.flatMap((fixtureCode) => {
    const fixture = listed.get(fixtureCode);
    return fixture === undefined ? [] : [{ fixtureCode, fixture }];
  });
  return readEach(found, ({ fixtureCode }) => fixtureCode, ({ fixture, fixtureCode }) => plScoreRead(fixture, fixtureCode));
}

/** One match: its sheets and every named man's Premier League stats, merged with FPL's and
 *  upserted; before full time, null if waiting, or written as live, its threshold steps with it. */
async function syncMatch(
  ctx: ActionCtx,
  fixtureCode: number,
  { gameweek, codeByOpta, fplLines, listed, clocks }: GameweekReads,
  readAt: number,
  beforeFullTime: BeforeFullTime,
): Promise<{ outcome: MatchOutcome; thresholdSteps: SideMatchOutcome | null } | null> {
  const summary = listed.get(fixtureCode);
  if (summary === undefined) throw new Error(`the Premier League lists no match ${fixtureCode} in gameweek ${gameweek}`);
  if (summary.status === undefined) throw new Error(`PL fixture ${summary.id} carries no status`);
  const fullTime = summary.status === PL_FULL_TIME;
  if (!fullTime && beforeFullTime === "wait") return null;
  const fixture = await readPlFixture(summary.id);
  const { slots, unmatched } = matchSlots(fixture, codeByOpta);
  const reads = new Map(
    await Promise.all(namedMen(fixture).map(async (man) => [man.id, await readPlPlayerStats(man.id, fixture.id)] as const)),
  );
  const { lines } = plStatLines(fixture, reads, codeByOpta);
  const records = matchRecords(fixtureCode, slots, fplLines, lines);
  const matchOutcome = (written: Infer<typeof matchWrites>): MatchOutcome => ({ fixtureCode, ok: true, ...written, players: records.length, unmatched });
  if (fullTime) {
    const written = await ctx.runMutation(internal.stats.matchStats.upsertMatch, { fixtureCode, readAt, records });
    return { outcome: matchOutcome(written), thresholdSteps: null };
  }
  const { thresholdSteps, ...written } = await ctx.runMutation(internal.stats.liveStats.upsertLive, {
    fixtureCode,
    minute: clocks.get(fixtureCode) ?? null,
    records,
  });
  return { outcome: matchOutcome(written), thresholdSteps };
}
