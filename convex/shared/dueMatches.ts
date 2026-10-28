// The matches a feed read is due for, shared by the stats and football layers so neither imports
// the other's modules to name them: stats/ reads their records, football/ their team sheets.

import { v, type Infer } from "convex/values";

/** A match to read, and the gameweek its live stats come under. */
export const dueMatch = v.object({ fixtureCode: v.number(), gameweek: v.number() });
export type DueMatch = Infer<typeof dueMatch>;

/** The matches by gameweek, each gameweek's in the order given. */
export function byGameweek(due: DueMatch[]): Map<number, number[]> {
  const codes = new Map<number, number[]>();
  for (const { fixtureCode, gameweek } of due) codes.set(gameweek, [...(codes.get(gameweek) ?? []), fixtureCode]);
  return codes;
}
