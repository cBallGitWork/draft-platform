// The matches a feed read is due for, shared by the stats and football layers so neither imports
// the other's modules to name them: stats/ reads their records, football/ their team sheets.

import { v, type Infer } from "convex/values";
import { groupedBy } from "./groupedBy";
import { HOUR_MS } from "./time";

/** The longest a match is polled after kickoff: 105 minutes of play and half-time, stoppage time,
 *  a delayed kickoff and the minutes after full time while records still arrive. One the Premier
 *  League has not called full time by then is abandoned or its status is stuck, and is left to
 *  `matchStatsSync`. Both live pollers (stats/liveStats.ts, football/sportmonks/sportmonksLive.ts)
 *  read it. Claude's choice, as long as `scripts/record-match.mjs` records for. */
export const LIVE_WINDOW_MS = 4 * HOUR_MS;

/** A match to read, and the gameweek its live stats come under. */
export const dueMatch = v.object({ fixtureCode: v.number(), gameweek: v.number() });
export type DueMatch = Infer<typeof dueMatch>;

/** The matches by gameweek, each gameweek's in the order given. */
export function byGameweek(due: DueMatch[]): Map<number, number[]> {
  const byWeek = groupedBy(due, ({ gameweek }) => gameweek);
  return new Map([...byWeek].map(([gameweek, matches]) => [gameweek, matches.map(({ fixtureCode }) => fixtureCode)]));
}
