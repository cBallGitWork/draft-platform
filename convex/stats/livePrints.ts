import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { PlayerMatchRecord } from "./matchRecords";

// The live tick's compact row (#2006, the liveMatchPrints table): one a match while it is live,
// holding each man's record as a print, so each minute's read is checked against one small row
// rather than the match's forty records, and only the men who moved are read and written. The
// row's being there also says the match's live records are counted in no season totals, points or
// Scouting row yet: full time counts them (matchStats.ts's upsertMatch) and deletes it. Plain
// helpers: no Convex function lives here.

/** One record as a number: equal for two records the feeds sent the same, as matchStats.ts's
 *  `sameRecord` reads them (a stat left out and one sent as 0 alike). cyrb53, a 53-bit string
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
