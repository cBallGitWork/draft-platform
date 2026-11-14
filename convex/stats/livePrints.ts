import type { Doc, Id } from "../_generated/dataModel";
import type { GameweekTeams } from "../gameweekScorer/gameweekScores";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { statChanges, type PlayerMatchRecord } from "./matchRecords";

// The live tick's compact row (#2006, the liveMatchPrints table): one a match while it is live,
// holding each man's record as a print, so each minute's read is checked against one small row
// rather than the match's forty records, and only the men who moved are read and written. The
// row's being there also says the match's live records are counted in no season totals, points or
// Scouting row yet: full time counts them (matchStats.ts's upsertMatch) and deletes it. Beside it,
// a match's live points delay (the livePointsDelays table, spec/10 `S10.12`). Plain helpers: no
// Convex function lives here.

/** What the feeds sent is what is held; a stat left out and a stat sent as 0 read the same. */
export function sameRecord(row: Doc<"playerMatchStats">, record: PlayerMatchRecord): boolean {
  return (
    row.started === record.started &&
    row.played === record.played &&
    row.arrived.fpl === record.arrived.fpl &&
    row.arrived.pl === record.arrived.pl &&
    statChanges(row.stats, record.stats).length === 0
  );
}

/** One record as a number: equal for two records the feeds sent the same, as `sameRecord` above
 *  reads them (a stat left out and one sent as 0 alike). cyrb53, a 53-bit string
 *  hash, so a moved record reading as unmoved is about one chance in 2^53. */
export function recordPrint(record: Pick<PlayerMatchRecord, "started" | "played" | "arrived" | "stats">): number {
  const stats = Object.entries(record.stats)
    .filter(([, value]) => value !== 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([stat, value]) => `${stat}=${value}`)
    .join(";");
  return cyrb53(`${record.started}|${record.played}|${record.arrived.fpl}|${record.arrived.pl}|${stats}`);
}

/** The match's compact row, or null while it has none: before its first live write, and from full time on. */
export function livePrintsOf(ctx: QueryCtx, fixtureCode: number): Promise<Doc<"liveMatchPrints"> | null> {
  return ctx.db
    .query("liveMatchPrints")
    .withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", fixtureCode))
    .unique();
}

/** The match's live points delay (spec/10 `S10.12`), or null while they keep up. */
export function livePointsDelayOf(ctx: QueryCtx, fixtureCode: number): Promise<Doc<"livePointsDelays"> | null> {
  return ctx.db
    .query("livePointsDelays")
    .withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", fixtureCode))
    .unique();
}

/** Whether any match the teams' lineups' men play in has its live points delayed: the matchup's
 *  scoreboard then says "Live points delayed" (spec/10 `S10.12`). */
export async function lineupPointsDelayed(ctx: QueryCtx, inGameweek: GameweekTeams, teamIds: readonly Id<"teams">[]): Promise<boolean> {
  const codes = new Set<number>();
  for (const teamId of teamIds) {
    for (const matches of (await inGameweek.slotsOf(teamId)).matchesOf.values()) for (const { fixture } of matches) codes.add(fixture.code);
  }
  for (const code of codes) if ((await livePointsDelayOf(ctx, code)) !== null) return true;
  return false;
}

/** The match's live points delayed from `readAt`; one already delayed keeps its moment. */
export async function delayPoints(ctx: MutationCtx, fixtureCode: number, readAt: number): Promise<void> {
  if ((await livePointsDelayOf(ctx, fixtureCode)) === null) await ctx.db.insert("livePointsDelays", { fixtureCode, delayedFrom: readAt });
}

/** The match's live points no longer delayed: a full read, or full time, wrote them. */
export async function undelayPoints(ctx: MutationCtx, fixtureCode: number): Promise<void> {
  const delay = await livePointsDelayOf(ctx, fixtureCode);
  if (delay !== null) await ctx.db.delete("livePointsDelays", delay._id);
}

/** Whether the match's records are live ones no season row counts yet. */
export async function countedNowhere(ctx: QueryCtx, fixtureCode: number): Promise<boolean> {
  return (await livePrintsOf(ctx, fixtureCode)) !== null;
}

/** cyrb53 (bryc, public domain): a fast 53-bit hash of a string. */
function cyrb53(text: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
