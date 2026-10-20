import { v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, type ActionCtx } from "./_generated/server";
import { codesByOpta, fixtureCodeIn, namedMen } from "./feedIds";
import { readFplPayloads, type RawBootstrap, type RawFixture } from "./fpl";
import { fplStatLines, readFplLive, type FplStatLine } from "./fplLive";
import { matchRecords } from "./matchRecords";
import { matchSlots, plStatLines } from "./plMatch";
import { PL_FULL_TIME, readPlFixture, readPlFixtures, readPlPlayerStats, type RawPlFixture } from "./premierLeague";
import { matchStatsSyncFields, matchStatsSyncTrigger, type matchSyncOutcome } from "./schema";

// Issue #27: every due match's stats from both feeds, one record per named man, upserted with
// `matchStats.upsertMatch`. No cron runs it yet (ARCHITECTURE.md); from the CLI:
// `npx convex run matchStatsSync:run '{"trigger":"manual"}'`, then `matchStats:latest`.
// A match that fails is on the run row with its error, and the others still sync.

type Outcome = Infer<typeof matchStatsSyncFields.outcome>;
type MatchOutcome = Infer<typeof matchSyncOutcome>;
type DueMatch = { fixtureCode: number; gameweek: number };

/** FPL's reads every match of a run shares. */
interface FplReads {
  elements: RawBootstrap["elements"];
  fixtures: RawFixture[];
  codeByOpta: Map<string, number>;
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
      outcome = { ok: false, error: failure("match stats sync failed", error) };
    }
    await ctx.runMutation(internal.matchStats.record, { trigger, ranAt, outcome });
  },
});

/** Each due match a gameweek at a time, since FPL's live stats and the Premier League's list come
 *  by gameweek. A match the Premier League does not yet call full time waits for a later run. */
async function syncDue(ctx: ActionCtx, due: DueMatch[], readAt: number) {
  const { bootstrap, fixtures } = await readFplPayloads();
  const fpl: FplReads = { elements: bootstrap.elements, fixtures, codeByOpta: codesByOpta(bootstrap.elements) };
  const matches: MatchOutcome[] = [];
  const waiting: number[] = [];
  for (const [gameweek, codes] of byGameweek(due)) {
    let fplLines: FplStatLine[];
    let listed: Map<number | null, RawPlFixture>;
    try {
      const [live, round] = await Promise.all([readFplLive(gameweek), readPlFixtures(gameweek)]);
      fplLines = fplStatLines(live, fpl.elements, fpl.fixtures);
      listed = new Map(round.map((fixture) => [fixtureCodeIn(fixture), fixture]));
    } catch (error: unknown) {
      const message = failure(`gameweek ${gameweek}'s reads failed`, error);
      matches.push(...codes.map((fixtureCode) => ({ fixtureCode, ok: false as const, error: message })));
      continue;
    }
    for (const fixtureCode of codes) {
      const plFixture = listed.get(fixtureCode);
      try {
        if (plFixture === undefined) throw new Error(`the Premier League lists no match ${fixtureCode} in gameweek ${gameweek}`);
        if (plFixture.status === undefined) throw new Error(`PL fixture ${plFixture.id} carries no status`);
        if (plFixture.status !== PL_FULL_TIME) {
          waiting.push(fixtureCode);
          continue;
        }
        matches.push(await syncMatch(ctx, plFixture.id, fixtureCode, fplLines, fpl.codeByOpta, readAt));
      } catch (error: unknown) {
        matches.push({ fixtureCode, ok: false, error: failure(`match ${fixtureCode} failed`, error) });
      }
    }
  }
  return { matches, waiting };
}

/** One match at full time: its sheets, every named man's Premier League stats, merged with FPL's. */
async function syncMatch(
  ctx: ActionCtx,
  plFixtureId: number,
  fixtureCode: number,
  fplLines: FplStatLine[],
  codeByOpta: Map<string, number>,
  readAt: number,
): Promise<MatchOutcome> {
  const fixture = await readPlFixture(plFixtureId);
  const { slots, unmatched } = matchSlots(fixture, codeByOpta);
  const reads = new Map(
    await Promise.all(namedMen(fixture).map(async (man) => [man.id, await readPlPlayerStats(man.id, fixture.id)] as const)),
  );
  const { lines } = plStatLines(fixture, reads, codeByOpta);
  const records = matchRecords(fixtureCode, slots, fplLines, lines);
  const written = await ctx.runMutation(internal.matchStats.upsertMatch, { fixtureCode, readAt, records });
  return {
    fixtureCode,
    ok: true,
    ...written,
    players: records.length,
    unmatched,
  };
}

function byGameweek(due: DueMatch[]): Map<number, number[]> {
  const codes = new Map<number, number[]>();
  for (const { fixtureCode, gameweek } of due) codes.set(gameweek, [...(codes.get(gameweek) ?? []), fixtureCode]);
  return codes;
}

/** The error's message, logged so a failure is seen in Convex's logs as well as on the run row. */
function failure(what: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${what}: ${message}`);
  return message;
}
