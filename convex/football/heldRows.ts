import type { Value } from "convex/values";

// How a feed's row is matched to the one the site holds, for every feed adapter's sync: on its
// stable key, then field by field (footballSync.ts, sportmonks/sportmonksSync.ts).

/** A record or a held row, by the key it is matched on: a gameweek's season is absent only on a
 *  row from before #66. */
export type Keyed = { code: number } | { season?: number; number: number };
/** A gameweek's key's step a season: past any gameweek number. */
const SEASON_KEY_STEP = 100;

/** A row's stable key: a club's, player's or match's season-stable code, or a gameweek's season
 *  and number, 202605 for 2026/27's gameweek 5, so last season's is never taken for this one's
 *  (#66). A row from before #66, with no season, keys on its number alone. */
export function keyOf(row: Keyed): number {
  if ("code" in row) return row.code;
  return row.season === undefined ? row.number : row.season * SEASON_KEY_STEP + row.number;
}

/** Every field the feed sent equals the held one. The records are flat, so `===` compares them;
 *  `droppedAt` is the platform's, never sent, so it is not compared. */
export function sameFields(row: Record<string, Value>, held: Record<string, Value>): boolean {
  return Object.keys(row).every((field) => row[field] === held[field]);
}
