import type { Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, type ActionCtx } from "../_generated/server";
import { codesByOpta, fixtureCodeIn, namedMen } from "../football/feedIds";
import { logFailure } from "../shared/errors";
import { readFplPayloads } from "../football/fpl";
import { fplStatLines, readFplLive, type FplStatLine } from "../football/fplLive";
import { matchRecords } from "./matchRecords";
import type { DueMatch } from "./matchStats";
import { matchSlots, plStatLines } from "../football/plMatch";
import { PL_FULL_TIME, readPlFixture, readPlFixtures, readPlPlayerStats, type RawPlFixture } from "../football/premierLeague";
import { matchStatsSyncFields, syncTrigger, type matchSyncOutcome } from "../schema";
import { writeScores } from "../football/matchScores";
import { plScoreRead, readEach, type ScoreReads } from "../football/scoreReads";

// Issue #27: every due match's stats from both feeds, one record per named man, upserted with
// `matchStats.upsertMatch`. No cron runs it yet (ARCHITECTURE.md); from the CLI:
// `npx convex run stats/matchStatsSync:run '{"trigger":"manual"}'`, then `stats/matchStats:latest`.

type Outcome = Infer<typeof matchStatsSyncFields.outcome>;
type MatchOutcome = Infer<typeof matchSyncOutcome>;

/** What every due match of one gameweek is read against. */
interface GameweekReads {
  gameweek: number;
  codeByOpta: Map<string, number>;
  fplLines: FplStatLine[];
  /** The Premier League's list for the gameweek, by FPL's fixture code. */
  listed: Map<number | null, RawPlFixture>;
}

export const run = internalAction({
  args: { trigger: syncTrigger },
  handler: async (ctx, { trigger }) => {
    const ranAt = Date.now();
    let outcome: Outcome;
    try {
      const due: DueMatch[] = await ctx.runQuery(internal.stats.matchStats.due, { now: ranAt });
      outcome = { ok: true, ...(due.length === 0 ? { matches: [], waiting: [] } : await syncDue(ctx, due, ranAt, "wait")) };
    } catch (error: unknown) {
      outcome = { ok: false, error: logFailure("match stats sync failed", error) };
    }
    await ctx.runMutation(internal.stats.matchStats.record, { trigger, ranAt, outcome });
  },
});

/** What a read does with a match the Premier League does not yet call full time: the sync leaves
 *  it "waiting" for a later run; the live tick (#28) writes it, provisional. */
export type BeforeFullTime = "wait" | "live";

/** Each due match a gameweek at a time, since FPL's live stats and the Premier League's list come
 *  by gameweek. A gameweek whose reads fail fails each of its matches; a match that fails fails alone. */
export async function syncDue(ctx: ActionCtx, due: DueMatch[], readAt: number, beforeFullTime: BeforeFullTime) {
  const { bootstrap, fixtures } = await readFplPayloads();
  const codeByOpta = codesByOpta(bootstrap.elements);
  const matches: MatchOutcome[] = [];
  const waiting: number[] = [];
  const scores: ScoreReads = { reads: [], problems: [] };
  for (const [gameweek, codes] of byGameweek(due)) {
    let reads: GameweekReads;
    try {
      const [live, round] = await Promise.all([readFplLive(gameweek), readPlFixtures(gameweek)]);
      const fplLines = fplStatLines(live, bootstrap.elements, fixtures);
      reads = { gameweek, codeByOpta, fplLines, listed: new Map(round.map((each) => [fixtureCodeIn(each), each])) };
      const scored = dueScores(reads.listed, codes);
      scores.reads.push(...scored.reads);
      scores.problems.push(...scored.problems);
    } catch (error: unknown) {
      const message = logFailure(`gameweek ${gameweek}'s reads failed`, error);
      matches.push(...codes.map((fixtureCode) => ({ fixtureCode, ok: false as const, error: message })));
      continue;
    }
    for (const fixtureCode of codes) {
      try {
        const outcome = await syncMatch(ctx, fixtureCode, reads, readAt, beforeFullTime);
        if (outcome === null) waiting.push(fixtureCode);
        else matches.push(outcome);
      } catch (error: unknown) {
        matches.push({ fixtureCode, ok: false, error: logFailure(`match ${fixtureCode} failed`, error) });
      }
    }
  }
  return { matches, waiting, scores: await writeDueScores(ctx, readAt, scores) };
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
 *  upserted; before full time, null if waiting, or written as live. */
async function syncMatch(
  ctx: ActionCtx,
  fixtureCode: number,
  { gameweek, codeByOpta, fplLines, listed }: GameweekReads,
  readAt: number,
  beforeFullTime: BeforeFullTime,
): Promise<MatchOutcome | null> {
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
  const written = fullTime
    ? await ctx.runMutation(internal.stats.matchStats.upsertMatch, { fixtureCode, readAt, records })
    : await ctx.runMutation(internal.stats.liveStats.upsertLive, { fixtureCode, records });
  return { fixtureCode, ok: true, ...written, players: records.length, unmatched };
}

function byGameweek(due: DueMatch[]): Map<number, number[]> {
  const codes = new Map<number, number[]>();
  for (const { fixtureCode, gameweek } of due) codes.set(gameweek, [...(codes.get(gameweek) ?? []), fixtureCode]);
  return codes;
}
