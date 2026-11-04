// Reads of the stat catalogue (spec/14, The catalogue). The list itself is in statCatalogueList.ts.

import { STAT_CATALOGUE } from "./statCatalogueList";

/** The catalogue's stats by the name the record keeps each under. */
export const CATALOGUE_STATS: ReadonlySet<string> = new Set(STAT_CATALOGUE.map((entry) => entry.stat));

/** Refuses a stat the catalogue doesn't hold, for any of Scouting's reads that shows one. */
export function checkCatalogueStat(stat: string): void {
  if (!CATALOGUE_STATS.has(stat)) throw new Error(`No stat ${stat} is in the catalogue`);
}
