// The Premier League's ids for this season and the last, worked out once per run from its list of
// seasons (#300), so nobody edits them each summer. They follow FPL's season, not the list's newest:
// the Premier League may list 2027/28 in June while FPL still serves 2026/27, and reads go on with
// the season FPL is on until FPL switches, then switch the same day (Craig, 6 Nov 2026).

import { seasonName } from "../../shared/time";
import { getShaped, hasId, plCompSeasonsUrl, type PlSeasons } from "../football";

/** One season in the Premier League's list: its label and its own id for it. */
export interface RawPlCompSeason {
  label: string;
  id: number;
}

/** `/competitions/1/compseasons`: its seasons as a paged list's `content`, as the Premier League's
 *  other lists come, or as a bare list. 31 Oct 2026's check noted the entries, not which. */
export type RawPlCompSeasons = { content: RawPlCompSeason[] } | RawPlCompSeason[];

const isCompSeason = (season: any): boolean => hasId(season) && typeof season?.label === "string";

/** The year a season's label says it starts: 2026 from "English Premier League Season 2026/2027"
 *  and from "2026/27"; null from a label naming no season. */
export function labelStartYear(label: string): number | null {
  const found = /(\d{4})\/(\d{4}|\d{2})\b/.exec(label);
  return found === null ? null : Number(found[1]);
}

/** Why a run read nothing: the Premier League lists no season, or more than one, starting in
 *  `startYear`, looked for as FPL is on `fplSeason`. */
export function plSeasonMissing(startYear: number, fplSeason: number, listed = 0): string {
  const lists = listed === 0 ? "lists no" : `lists ${listed} seasons labelled`;
  return `The Premier League ${lists} ${seasonName(startYear)} at ${plCompSeasonsUrl()}, looked for as FPL is on ${seasonName(fplSeason)}`;
}

/** The Premier League's ids for `fplSeason` (the year FPL's season starts) and the season before,
 *  chosen by their labels, never the list's order. A season missing from the list throws, naming
 *  the one looked for: each sync records it as failed, and nothing is read with a guessed id. */
export function pickPlSeasons(seasons: RawPlCompSeason[], fplSeason: number): PlSeasons {
  const idOf = (startYear: number): number => {
    const found = seasons.filter((season) => labelStartYear(season.label) === startYear);
    if (found.length !== 1) throw new Error(plSeasonMissing(startYear, fplSeason, found.length));
    return found[0].id;
  };
  return { current: idOf(fplSeason), last: idOf(fplSeason - 1) };
}

/** The Premier League's ids for `fplSeason` and the season before, from its list of seasons. */
export async function readPlSeasons(fplSeason: number): Promise<PlSeasons> {
  const body = await getShaped<RawPlCompSeasons>(plCompSeasonsUrl(), "list of seasons with labels and ids", (read) => {
    const seasons: unknown = Array.isArray(read) ? read : read.content;
    return Array.isArray(seasons) && seasons.every(isCompSeason);
  });
  return pickPlSeasons(Array.isArray(body) ? body : body.content, fplSeason);
}
