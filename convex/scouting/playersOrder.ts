// Which of Scouting's players the filters keep, and in what order (#373): the list's rule, apart
// from playersList.ts so the preview and the tests share it without the server's imports.

import { EVENT_STATS, MINUTES_STAT } from "../stats/matchRecords";
import type { Stats } from "../stats/statTotals";
import type { Availability, FirstRunOfPlayer, ListedPlayer, ListedRow, ListFigure, PlayersFilters, PlayersSort } from "./playersList";

/** The figures every row of the list shows as season totals (the approved picture: Mins, G, A and
 *  SOT), by the stat each is kept under. Shots on target are Sportmonks' SHOTS_ON_TARGET, kept
 *  under Opta's name (sportmonksStats.ts). */
export const LIST_FIGURES = {
  minutes: MINUTES_STAT,
  goals: EVENT_STATS.goals,
  assists: EVENT_STATS.assists,
  shotsOnTarget: "ontarget_scoring_att",
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

/** A row as the server sends it or as the screens show it: the order reads only whether he is on
 *  waivers. */
type OrderedRow = Omit<ListedRow, "onWaivers"> & { onWaivers: object | null };

/** The players the filters keep, in the sort's order. */
export function listOf<Row extends OrderedRow>(players: readonly Row[], filters: PlayersFilters, sort: PlayersSort): Row[] {
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
function keptByAvailability(chosen: Availability, { ownerTeamName, onWaivers }: Pick<OrderedRow, "ownerTeamName" | "onWaivers">): boolean {
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

const byName = (one: OrderedRow, other: OrderedRow) => one.name.localeCompare(other.name) || one.code - other.code;

/** The players in the sort's order. A null figure sorts last whichever way, and ties fall back to
 *  the name, so the order never shifts between reads. */
function sortedPlayers<Row extends OrderedRow>(players: readonly Row[], { by, descending }: PlayersSort): Row[] {
  const direction = descending ? -1 : 1;
  const compare = (one: Row, other: Row): number => {
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

/** The list's rows as the screens show them: each on waivers with the run that can first take him,
 *  from `firstRuns` (#1467), or null while that loads or where it doesn't hold him. */
export function withFirstRuns(rows: readonly ListedRow[], runs: readonly FirstRunOfPlayer[] | undefined): ListedPlayer[] {
  const runOf = new Map((runs ?? []).map(({ playerCode, firstRun }) => [playerCode, firstRun]));
  return rows.map((row) => ({ ...row, onWaivers: row.onWaivers === null ? null : { firstRun: runOf.get(row.code) ?? null } }));
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
