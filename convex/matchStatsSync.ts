import type { Infer } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, type ActionCtx } from "./_generated/server";
import { codesByOpta, fixtureCodeIn, namedMen } from "./feedIds";
import { readFplPayloads } from "./fpl";
import { fplStatLines, readFplLive, type FplStatLine } from "./fplLive";
import { matchRecords } from "./matchRecords";
import type { DueMatch } from "./matchStats";
import { matchSlots, plStatLines } from "./plMatch";
import { PL_FULL_TIME, readPlFixture, readPlFixtures, readPlPlayerStats, type RawPlFixture } from "./premierLeague";
import { matchStatsSyncFields, matchStatsSyncTrigger, type matchSyncOutcome } from "./schema";

// Issue #27: every due match's stats from both feeds, one record per named man, upserted with
// `matchStats.upsertMatch`. No cron runs it yet (ARCHITECTURE.md); from the CLI:
// `npx convex run matchStatsSync:run '{"trigger":"manual"}'`, then `matchStats:latest`.

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
  args: { trigger: matchStatsSyncTrigger },
  handler: async (ctx, { trigger }) => {
    const ranAt = Date.now();
    let outcome: Outcome;
    try {
      const due: DueMatch[] = await ctx.runQuery(internal.matchStats.due, { now: ranAt });
      outcome = { ok: true, ...(due.length === 0 ? { matches: [], waiting: [] } : await syncDue(ctx, due, ranAt)) };
    } catch (error: unknown) {
      outcome = { ok: false, error: logFailure("match stats sync failed", error) };
    }
    await ctx.runMutation(internal.matchStats.record, { trigger, ranAt, outcome });
  },
});

/** Each due match a gameweek at a time, since FPL's live stats and the Premier League's list come
 *  by gameweek. A gameweek whose reads fail fails each of its matches; a match that fails fails alone. */
async function syncDue(ctx: ActionCtx, due: DueMatch[], readAt: number) {
  const { bootstrap, fixtures } = await readFplPayloads();
  const codeByOpta = codesByOpta(bootstrap.elements);
  const matches: MatchOutcome[] = [];
  const waiting: number[] = [];
  for (const [gameweek, codes] of byGameweek(due)) {
    let reads: GameweekReads;
    try {
      const [live, round] = await Promise.all([readFplLive(gameweek), readPlFixtures(gameweek)]);
      const fplLines = fplStatLines(live, bootstrap.elements, fixtures);
      reads = { gameweek, codeByOpta, fplLines, listed: new Map(round.map((each) => [fixtureCodeIn(each), each])) };
    } catch (error: unknown) {
      const message = logFailure(`gameweek ${gameweek}'s reads failed`, error);
      matches.push(...codes.map((fixtureCode) => ({ fixtureCode, ok: false as const, error: message })));
      continue;
    }
    for (const fixtureCode of codes) {
      try {
        const outcome = await syncMatch(ctx, fixtureCode, reads, readAt);
        if (outcome === null) waiting.push(fixtureCode);
        else matches.push(outcome);
      } catch (error: unknown) {
        matches.push({ fixtureCode, ok: false, error: logFailure(`match ${fixtureCode} failed`, error) });
      }
    }
  }
  return { matches, waiting };
}

/** One match: null while the Premier League does not yet call it full time; then its sheets and
 *  every named man's Premier League stats, merged with FPL's and upserted. */
async function syncMatch(
  ctx: ActionCtx,
  fixtureCode: number,
  { gameweek, codeByOpta, fplLines, listed }: GameweekReads,
  readAt: number,
): Promise<MatchOutcome | null> {
  const summary = listed.get(fixtureCode);
  if (summary === undefined) throw new Error(`the Premier League lists no match ${fixtureCode} in gameweek ${gameweek}`);
  if (summary.status === undefined) throw new Error(`PL fixture ${summary.id} carries no status`);
  if (summary.status !== PL_FULL_TIME) return null;
  const fixture = await readPlFixture(summary.id);
  const { slots, unmatched } = matchSlots(fixture, codeByOpta);
  const reads = new Map(
    await Promise.all(namedMen(fixture).map(async (man) => [man.id, await readPlPlayerStats(man.id, fixture.id)] as const)),
  );
  const { lines } = plStatLines(fixture, reads, codeByOpta);
  const records = matchRecords(fixtureCode, slots, fplLines, lines);
  const written = await ctx.runMutation(internal.matchStats.upsertMatch, { fixtureCode, readAt, records });
  return { fixtureCode, ok: true, ...written, players: records.length, unmatched };
}

function byGameweek(due: DueMatch[]): Map<number, number[]> {
  const codes = new Map<number, number[]>();
  for (const { fixtureCode, gameweek } of due) codes.set(gameweek, [...(codes.get(gameweek) ?? []), fixtureCode]);
  return codes;
}

/** The error's message, logged so a failure is seen in Convex's logs as well as on the run row. */
function logFailure(what: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${what}: ${message}`);
  return message;
}
