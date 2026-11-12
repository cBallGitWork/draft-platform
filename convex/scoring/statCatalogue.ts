// Reads of the stat catalogue (spec/14, The catalogue). The list itself is in statCatalogueList.ts.
// A key with a colon is reserved: no catalogue stat has one, and every own stat's key starts with
// `OWN_STAT_PREFIX` (statKeys.ts), so a stat the feeds start sending can join the catalogue, or one leave it,
// without its key meeting an own stat's saved before (#136). The system makes an own stat's key
// when the make-an-own-stat screen is built, never the admin.

import { STAT_CATALOGUE } from "./statCatalogueList";

/** The catalogue's stats by the name the record keeps each under. */
export const CATALOGUE_STATS: ReadonlySet<string> = new Set(STAT_CATALOGUE.map((entry) => entry.stat));

/** Refuses a stat the catalogue doesn't hold, for any of Scouting's reads that shows one. */
export function checkCatalogueStat(stat: string): void {
  if (!CATALOGUE_STATS.has(stat)) throw new Error(`No stat ${stat} is in the catalogue`);
}
