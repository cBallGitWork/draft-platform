// A league's own stats (#112, spec/14 Own stats): what one is, the check that refuses a bad one,
// and how one is worked out from a player's record before the league's rules score it.

import { statIn, type MatchStats } from "./scoring";
import { requireNumber, showValue, type ScoringSet } from "./scoringSet";
import { CATALOGUE_STATS } from "./statCatalogue";

/** A stat of the league's own (spec/14, Own stats): catalogue stats added up, each with a weight,
 *  which can be negative: tackles + 0.5 × clearances. A rule scores it by `stat`, as any category. */
export interface OwnStat {
  stat: string;
  name: string;
  shortCode: string;
  parts: readonly { stat: string; weight: number }[];
}

/** Own stats are made of catalogue stats only, never another own stat (spec/14), and each has a
 *  key, a name and a short code of its own, none a catalogue stat's. */
export function validateOwnStats(ownStats: unknown): void {
  if (!Array.isArray(ownStats)) throw new Error("a scoring set's own stats must be a list");
  const keys = new Set<string>();
  const names = new Set<string>();
  const codes = new Set<string>();
  ownStats.forEach((own: unknown, index) => {
    if (!isRecord(own) || typeof own.stat !== "string" || own.stat === "") throw new Error(`own stat ${index + 1} has no key`);
    const named = `the own stat ${own.stat}`;
    if (CATALOGUE_STATS.has(own.stat)) throw new Error(`${named} has a catalogue stat's key`);
    if (keys.has(own.stat)) throw new Error(`${named} is made twice`);
    keys.add(own.stat);
    for (const [field, seen] of [["name", names], ["shortCode", codes]] as const) {
      const value = own[field];
      if (typeof value !== "string" || value.trim() === "") throw new Error(`${named} has no ${field === "name" ? "name" : "short code"}`);
      if (seen.has(value)) throw new Error(`${named} has the ${field === "name" ? "name" : "short code"} ${showValue(value)}, which another own stat has`);
      seen.add(value);
    }
    if (!Array.isArray(own.parts) || own.parts.length === 0) throw new Error(`${named} adds up no stats`);
    own.parts.forEach((part: unknown) => {
      if (!isRecord(part) || typeof part.stat !== "string") throw new Error(`${named} has a part that names no stat`);
      if (!CATALOGUE_STATS.has(part.stat)) throw new Error(`${named} adds ${showValue(part.stat)}, which isn't a catalogue stat`);
      requireNumber(part.weight, `${named} weighs ${part.stat} at`);
    });
  });
}

/** His record with the league's own stats added, each worked out from his catalogue stats (spec/14,
 *  Own stats). Under whole points only, an own stat counts whole actions, rounded down. */
export function withOwnStats(record: MatchStats, set: ScoringSet): MatchStats {
  if (set.ownStats === undefined || set.ownStats.length === 0) return record;
  const own: Record<string, number> = {};
  for (const { stat, parts } of set.ownStats) {
    // Floating point's noise goes first, so 0.1 × 30 is 3 and never just under it.
    const actions = Math.round(parts.reduce((total, part) => total + part.weight * statIn(record, part.stat), 0) * 1e6) / 1e6;
    own[stat] = set.wholePointsOnly ? Math.floor(actions) : actions;
  }
  return { ...record, ...own };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
