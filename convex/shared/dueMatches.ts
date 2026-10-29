// The matches a feed read is due for, shared by the stats and football layers so neither imports
// the other's modules to name them: stats/ reads their records, football/ their team sheets.

import { v, type Infer } from "convex/values";
import { groupedBy } from "./groupedBy";

/** A match to read, and the gameweek its live stats come under. */
export const dueMatch = v.object({ fixtureCode: v.number(), gameweek: v.number() });
export type DueMatch = Infer<typeof dueMatch>;

/** The matches by gameweek, each gameweek's in the order given. */
export function byGameweek(due: DueMatch[]): Map<number, number[]> {
  const byWeek = groupedBy(due, ({ gameweek }) => gameweek);
  return new Map([...byWeek].map(([gameweek, matches]) => [gameweek, matches.map(({ fixtureCode }) => fixtureCode)]));
}
