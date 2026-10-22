// A scoring set's categories by name (spec/14: the rules editor uses full names): what the editor
// lists, what a refusal names, and what a rules-change letter says changed.

import type { OwnStat } from "./ownStats";
import { STAT_CATALOGUE } from "./statCatalogue";

const CATALOGUE_NAMES: ReadonlyMap<string, string> = new Map(STAT_CATALOGUE.map(({ stat, name }) => [stat, name]));

/** A category's full name: the league's own stat's, else the catalogue's, else its key, as a rule
 *  may name a stat the catalogue hasn't listed yet (statCatalogue.ts). */
export function categoryName(stat: string, ownStats: readonly OwnStat[] = []): string {
  return ownStats.find((own) => own.stat === stat)?.name ?? CATALOGUE_NAMES.get(stat) ?? stat;
}
