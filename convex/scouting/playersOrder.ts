// Which of Scouting's players the filters keep, and in what order (#373): the list's rule, apart
// from playersList.ts so the preview and the tests share it without the server's imports.

import type { Availability, ListedPlayer, PlayersFilters, PlayersSort } from "./playersList";

/** The players the filters keep, in the sort's order. No player is on waivers until waivers are built. */
export function listOf(players: readonly ListedPlayer[], filters: PlayersFilters, sort: PlayersSort): ListedPlayer[] {
  const kept = players.filter(
    (player) =>
      heldAs(filters.availability, player.ownerTeamName) &&
      (filters.position === null || player.positions.includes(filters.position)) &&
      (filters.clubCode === null || player.club.code === filters.clubCode),
  );
  return sortedPlayers(kept, sort);
}

/** Whether a player with this owner (null for none) is one the availability keeps. */
function heldAs(chosen: Availability, ownerTeamName: string | null): boolean {
  switch (chosen) {
    case "all":
      return true;
    case "freeAgents":
      return ownerTeamName === null;
    case "onWaivers":
      return false;
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
      case "seasonPoints":
        return compareFigures(one.seasonPoints, other.seasonPoints, direction) || byName(one, other);
    }
  };
  return [...players].sort(compare);
}

/** Two figures in `direction`, a null one after any number. */
function compareFigures(one: number | null, other: number | null, direction: number): number {
  if (one === null || other === null) return (one === null ? 1 : 0) - (other === null ? 1 : 0);
  return direction * (one - other);
}
