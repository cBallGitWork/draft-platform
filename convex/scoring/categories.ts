// A scoring set's categories by name (spec/14: the rules editor uses full names): what the editor
// lists, what a refusal names, and what a patch's letter says changed.

import type { OwnStat } from "./ownStats";
import { STAT_CATALOGUE } from "./statCatalogue";

const CATALOGUE_NAMES: ReadonlyMap<string, string> = new Map(STAT_CATALOGUE.map(({ stat, name }) => [stat, name]));

/** A category's full name: the site's own stat's, else the catalogue's, else its key, so a
 *  stat in neither, which a rule is refused for (ruleChecks.ts), can still be named. */
export function categoryName(stat: string, ownStats: readonly OwnStat[] = []): string {
  return ownStats.find((own) => own.stat === stat)?.name ?? CATALOGUE_NAMES.get(stat) ?? stat;
}
