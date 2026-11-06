// The Premier League's list of seasons (`/competitions/1/compseasons`), cut to the newest three of
// the 35 Craig's check listed on 31 Oct 2026 (#300's first comment), as written there: newest first,
// a label and an id, the newest's label long-form and the older ones short. Typed by hand, not
// recorded, so it is a .ts and not a .json.

import { plCompSeasonsUrl } from "../../../convex/football/football";
import type { RawPlCompSeason } from "../../../convex/football/premierLeague/plSeasons";

/** The year the season every recording here is of starts: 2026/27, as FPL's recorded gameweeks say. */
export const FPL_SEASON = 2026;
/** FPL's bootstrap gameweeks, cut to the first as fpl-bootstrap-static.json recorded it, for a faked
 *  bootstrap that has none: what says which season FPL is on (`fplSeason`). */
export const FPL_GAMEWEEKS = [{ id: 1, deadline_time: "2026-08-21T17:30:00Z" }];
/** The Premier League's ids for 2026/27 and 2025/26. */
export const PL_THIS_SEASON = 841;
export const PL_LAST_SEASON = 777;

/** A fresh copy of the list's three newest seasons, safe to change. */
export function plSeasonList(): RawPlCompSeason[] {
  return [
    { label: "English Premier League Season 2026/2027", id: PL_THIS_SEASON },
    { label: "2025/26", id: PL_LAST_SEASON },
    { label: "2024/25", id: 719 },
  ];
}

/** The list as the feed answers it, keyed by its URL, for a test's faked fetch. */
export function plSeasonsBody(seasons: RawPlCompSeason[] = plSeasonList()): [string, unknown] {
  return [plCompSeasonsUrl(), { content: seasons }];
}
