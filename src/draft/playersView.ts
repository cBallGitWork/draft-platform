// What the draft room's players list shows, and in what order (the approved draft room picture;
// #1099): Scouting's players, those nobody has drafted, each with his draft figures
// (convex/draft/draftPlayers.ts `figures`), kept by the position tab and Find, and sorted by the
// column head pressed, opening on the site's ranking. Pure, so the tests and the screen share it.

import { POSITIONS, type Position } from "../../convex/positions/positionTables";
import type { OverviewStat } from "../../convex/draft/draftPlayers";
import type { ListedPlayer } from "../scouting/seam";
import type { RoomFigure } from "./seam";

/** A player on the list: Scouting's, with his draft figures, or none while he has none (a player
 *  who joined since they were read). */
export type RoomPlayer = ListedPlayer & { figure: RoomFigure | null };

/** The overview's columns, in the picture's order. */
export const OVERVIEW_COLUMNS = ["appearances", "goals", "assists", "cleanSheets"] as const satisfies readonly OverviewStat[];

/** What the list can be sorted by: a figure's column, or the player's name. */
export type RoomSortColumn = "name" | "rank" | "lastSeasonPoints" | OverviewStat | "stat";
export type RoomSort = { by: RoomSortColumn; descending: boolean };

/** The list opens on the site's ranking, best first (the approved picture's README). */
export const OPENING_SORT: RoomSort = { by: "rank", descending: false };

/** A head pressed first sorts names A to Z, the ranking best first, and every other figure most first. */
export const FIRST_DESCENDING: Record<RoomSortColumn, boolean> = {
  name: false,
  rank: false,
  lastSeasonPoints: true,
  appearances: true,
  goals: true,
  assists: true,
  cleanSheets: true,
  stat: true,
};

/** Each player with his figure, by his code. */
export function withFigures(players: readonly ListedPlayer[], figures: readonly RoomFigure[]): RoomPlayer[] {
  const byCode = new Map(figures.map((figure) => [figure.code, figure]));
  return players.map((player) => ({ ...player, figure: byCode.get(player.code) ?? null }));
}

/** The positions any of these players plays, in POSITIONS' order: the list's tabs after All. */
export const positionsPlayed = (players: readonly ListedPlayer[]): Position[] =>
  POSITIONS.filter((position) => players.some((player) => player.positions.includes(position)));

/** Words folded for Find: lower case with accents dropped, so "joao" finds João Pedro. */
const folded = (words: string) => words.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Whether Find's `text` names the player, in his short or full name, or his club's name or code. */
const found = (player: ListedPlayer, text: string) =>
  [player.name, player.fullName, player.club.name, player.club.shortName].some((each) => folded(each).includes(text));

/** The players the position tab (null for All) and Find keep. */
export function keptPlayers<Player extends ListedPlayer>(players: readonly Player[], position: Position | null, find: string): Player[] {
  const text = folded(find.trim());
  return players.filter((player) => (position === null || player.positions.includes(position)) && (text === "" || found(player, text)));
}

/** A player's figure in a column, or null where he has none. */
function figureOf(player: RoomPlayer, by: Exclude<RoomSortColumn, "name">): number | null {
  switch (by) {
    case "rank":
      return player.figure?.rank ?? null;
    case "lastSeasonPoints":
      return player.figure?.lastSeasonPoints ?? null;
    case "stat":
      return player.stat;
    default:
      return player.figure?.overview[by] ?? null;
  }
}

/** The players in the sort's order. A missing figure sorts last whichever way, and ties fall back
 *  to the name, so the order never shifts between reads. */
export function sortedPlayers(players: readonly RoomPlayer[], { by, descending }: RoomSort): RoomPlayer[] {
  const byName = (one: RoomPlayer, other: RoomPlayer) => one.name.localeCompare(other.name) || one.code - other.code;
  const direction = descending ? -1 : 1;
  return [...players].sort((one, other) => {
    if (by === "name") return direction * byName(one, other);
    const [mine, theirs] = [figureOf(one, by), figureOf(other, by)];
    if (mine === theirs) return byName(one, other);
    if (mine === null) return 1;
    if (theirs === null) return -1;
    return direction * (mine - theirs) || byName(one, other);
  });
}
