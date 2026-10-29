// The site's own stats (#112, spec/14 Own stats): what one is, the check that refuses a bad one,
// and how one is worked out from a player's record before the site's scoring set scores it.

import { statIn, type MatchStats } from "./scoring";
import { requireNumber, showValue, UnsoundScoring, type ScoringSet } from "./scoringSet";
import { CATALOGUE_STATS, STAT_CATALOGUE } from "./statCatalogue";

/** What an own stat is rounded to before it counts: a millionth, far finer than any weight, so
 *  only floating point's noise goes. */
const ACTIONS_PRECISION = 1e6;

/** A stat of the site's own (spec/14, Own stats): catalogue stats added up, each with a weight,
 *  which can be negative: tackles + 0.5 × clearances. A rule scores it by `stat`, as any category. */
export interface OwnStat {
  stat: string;
  name: string;
  shortCode: string;
  parts: readonly { stat: string; weight: number }[];
}

/** How a reason names an own stat's name and short code. */
const FIELD_WORDS = { name: "name", shortCode: "short code" } as const;

/** Own stats are made of catalogue stats only, never another own stat (spec/14), and each has a
 *  key no catalogue stat has, and a name and a short code no other own stat has. That no name or
 *  short code is a catalogue stat's is checked on saving only (`checkOwnStatsAgainstCatalogue`),
 *  as scoring runs this, and a catalogue stat renamed later mustn't stop the scoring (#212). */
export function validateOwnStats(ownStats: unknown): void {
  if (!Array.isArray(ownStats)) throw new UnsoundScoring("a scoring set's own stats must be a list");
  const keys = new Set<string>();
  const names = new Set<string>();
  const codes = new Set<string>();
  ownStats.forEach((own: unknown, index) => {
    if (!isRecord(own) || typeof own.stat !== "string" || own.stat === "") throw new UnsoundScoring(`own stat ${index + 1} has no key`);
    const named = `the own stat ${own.stat}`;
    if (CATALOGUE_STATS.has(own.stat)) throw new UnsoundScoring(`${named} has a catalogue stat's key`);
    if (keys.has(own.stat)) throw new UnsoundScoring(`${named} is made twice`);
    keys.add(own.stat);
    for (const [field, seen] of [["name", names], ["shortCode", codes]] as const) {
      const value = own[field];
      if (typeof value !== "string" || value.trim() === "") throw new UnsoundScoring(`${named} has no ${FIELD_WORDS[field]}`);
      if (seen.has(value)) throw new UnsoundScoring(`${named} has the ${FIELD_WORDS[field]} ${showValue(value)}, which another own stat has`);
      seen.add(value);
    }
    if (!Array.isArray(own.parts) || own.parts.length === 0) throw new UnsoundScoring(`${named} adds up no stats`);
    own.parts.forEach((part: unknown) => {
      if (!isRecord(part) || typeof part.stat !== "string") throw new UnsoundScoring(`${named} has a part that names no stat`);
      if (!CATALOGUE_STATS.has(part.stat)) throw new UnsoundScoring(`${named} adds ${showValue(part.stat)}, which isn't a catalogue stat`);
      requireNumber(part.weight, `${named} weighs ${part.stat} at`);
    });
  });
}

/** How a name or short code is compared with the catalogue's: case and spaces aside, so "Won
 *  Tackle" is the catalogue's "Won tackle" and "w t" its "WT" (Craig, 22 Oct 2026). */
const nameKey = (value: string) => value.replace(/\s/g, "").toLowerCase();

/** The catalogue stat's name for each name and short code, keyed as `nameKey` compares them. */
const CATALOGUE_STAT_NAME_BY = {
  name: new Map(STAT_CATALOGUE.map((entry) => [nameKey(entry.name), entry.name])),
  shortCode: new Map(STAT_CATALOGUE.map((entry) => [nameKey(entry.shortCode), entry.name])),
};

/** Refuses an own stat named, or short-coded, as a catalogue stat is, so no two categories read
 *  alike. For saving only: see `validateOwnStats`. */
export function checkOwnStatsAgainstCatalogue(ownStats: readonly OwnStat[]): void {
  for (const own of ownStats) {
    for (const field of ["name", "shortCode"] as const) {
      const catalogueStat = CATALOGUE_STAT_NAME_BY[field].get(nameKey(own[field]));
      if (catalogueStat !== undefined) {
        throw new UnsoundScoring(`the own stat ${own.stat} has the ${FIELD_WORDS[field]} ${showValue(own[field])}, which the catalogue's ${catalogueStat} has`);
      }
    }
  }
}

/** His record with the site's own stats added, each worked out from his catalogue stats (spec/14,
 *  Own stats). Under whole points only, an own stat counts whole actions, rounded down. */
export function withOwnStats(record: MatchStats, set: ScoringSet): MatchStats {
  if (set.ownStats === undefined || set.ownStats.length === 0) return record;
  const own: Record<string, number> = {};
  for (const { stat, parts } of set.ownStats) {
    // Floating point's noise goes first, so 0.1 × 30 is 3 and never just under it.
    const actions = Math.round(parts.reduce((total, part) => total + part.weight * statIn(record, part.stat), 0) * ACTIONS_PRECISION) / ACTIONS_PRECISION;
    own[stat] = set.wholePointsOnly ? Math.floor(actions) : actions;
  }
  return { ...record, ...own };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
