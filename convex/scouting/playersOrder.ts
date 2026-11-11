// Which of Scouting's players the filters keep, and in what order (#373): the list's rule, apart
// from playersList.ts so the preview and the tests share it without the server's imports.

import { SHOTS_ON_TARGET } from "../scoring/statKeys";
import { EVENT_STATS, MINUTES_STAT } from "../stats/matchRecords";
import type { Stats } from "../stats/statTotals";
import type { Availability, ListedPlayer, ListFigure, PlayersFilters, PlayersSort } from "./playersList";

/** The figures every row of the list shows as season totals (the approved picture: Mins, G, A and
 *  SOT), by the stat each is kept under. Shots on target are Sportmonks' SHOTS_ON_TARGET, kept
 *  under Opta's name (sportmonksStats.ts). */
export const LIST_FIGURES = {
  minutes: MINUTES_STAT,
  goals: EVENT_STATS.goals,
  assists: EVENT_STATS.assists,
  shotsOnTarget: SHOTS_ON_TARGET,
} as const satisfies Record<ListFigure, string>;

/** His list figures from his season totals: 0 for each he hasn't, all 0 if he hasn't played. */
export function listFigures(totals: Stats | undefined): ListedPlayer["figures"] {
  const of = (stat: string) => totals?.[stat] ?? 0;
  return {
    minutes: of(LIST_FIGURES.minutes),
    goals: of(LIST_FIGURES.goals),
    assists: of(LIST_FIGURES.assists),
    shotsOnTarget: of(LIST_FIGURES.shotsOnTarget),
  };
}

/** The list figures of a player who hasn't played. */
export const NO_FIGURES = listFigures(undefined);

/** The players the filters keep, in the sort's order. */
export function listOf(players: readonly ListedPlayer[], filters: PlayersFilters, sort: PlayersSort): ListedPlayer[] {
  const kept = players.filter(
    (player) =>
      keptByAvailability(filters.availability, player) &&
      (filters.position === null || player.positions.includes(filters.position)) &&
      (filters.clubCode === null || player.club.code === filters.clubCode),
  );
  return sortedPlayers(kept, sort);
}

/** Whether the availability keeps the player: a free agent is on no team and not on waivers
 *  (spec/08). */
function keptByAvailability(chosen: Availability, { ownerTeamName, onWaivers }: Pick<ListedPlayer, "ownerTeamName" | "onWaivers">): boolean {
  switch (chosen) {
    case "all":
      return true;
    case "freeAgents":
      return ownerTeamName === null && onWaivers === null;
    case "onWaivers":
      return onWaivers !== null;
    case "owned":
      return ownerTeamName !== null;
  }
}

const byName = (one: ListedPlayer, other: ListedPlayer) => one.name.localeCompare(other.name) || one.code - other.code;

/** The players in the sort's order. A null figure sorts last whichever way, and ties fall back to
 *  the name, so the order never shifts between reads. */
function sortedPlayers(players: readonly ListedPlayer[], { by, descending }: PlayersSort): ListedPlayer[] {
  const direction = descending ? -1 : 1;
  const compare = (one: ListedPlayer, other: ListedPlayer): number => {
    switch (by) {
      case "name":
        return direction * byName(one, other);
      case "club":
        return direction * one.club.shortName.localeCompare(other.club.shortName) || byName(one, other);
      case "points":
        return compareFigures(one.points, other.points, direction) || byName(one, other);
      case "stat":
        return compareFigures(one.stat, other.stat, direction) || byName(one, other);
      default:
        return compareFigures(one.figures[by], other.figures[by], direction) || byName(one, other);
    }
  };
  return [...players].sort(compare);
}

/** Two figures in `direction`, a null one after any number. */
function compareFigures(one: number | null, other: number | null, direction: number): number {
  if (one === null || other === null) return (one === null ? 1 : 0) - (other === null ? 1 : 0);
  return direction * (one - other);
}

/** A player's season total of the shown stat, from his totals (undefined if he hasn't played this
 *  season, so 0), or null with no stat shown. */
export function shownStat(totals: Stats | undefined, stat: string | null): number | null {
  return stat === null ? null : (totals?.[stat] ?? 0);
}
