import { Link } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import { cardOpensAt } from "../../convex/playerCard/cardPoints";
import type { CatalogueStat } from "../../convex/scoring/statCatalogueList";
import { playerCardPath } from "../playerCard/paths";
import { PositionChip } from "../ui/PositionChip";
import { ShortlistStar } from "../ui/StarRating";
import { cellClassOf, ColumnHeads, type ColumnWords } from "../ui/ColumnHeads";
import { OwnerName } from "../ui/OwnerName";
import { ClubMark, ClubShort } from "../ui/ClubName";
import { statFigure } from "../shared/figures";
import type { ListedPlayer, Period, PlayersSort, SortColumn } from "./seam";
import {
  columns,
  figureWords,
  noFigureWords,
  noPeriodPointsWords,
  noPointsYetWords,
  notLastSeasonWords,
  onWaiversWords,
  periodColumns,
  seasonColumns,
  selectPlayerLabel,
  shortlistedLabel,
  statLabel,
} from "./words";

/** The list's columns, as the approved picture draws them: "points" and the figures are over the
 *  list's period, "stat" is the shown stat's total over it, and "owner" the Status column, drawn
 *  only where the view holds owned players. */
type Column = "positions" | "name" | "owner" | "minutes" | "points" | "goals" | "assists" | "shotsOnTarget" | "stat";
const FIGURES = ["minutes", "points", "goals", "assists", "shotsOnTarget"] as const;
/** What the list's heads sort by: the club has no column of its own, as the picture sets it after
 *  the name. */
export type ListSortColumn = Exclude<SortColumn, "club">;
export type ListSort = PlayersSort & { by: ListSortColumn };
/** The columns a head press sorts by: each sorts by the column of its own name. */
const SORTABLE: readonly ListSortColumn[] = ["name", ...FIGURES, "stat"];
/** Columns a phone leaves out, for room. */
const DESK_ONLY: readonly Column[] = ["owner", "goals", "assists", "shotsOnTarget"];

/** A column's cells: names read from the left, figures line up on the right, and a phone leaves
 *  out what it has no room for. */
const cellClasses = (column: Column) => cellClassOf(column === "positions" || column === "name" || column === "owner", DESK_ONLY.includes(column));

/** The players list itself: a head per column, sortable where it can be, and a row per player,
 *  which selects him. The points' head names the season they are from while they are last
 *  season's (`pointsSeason`); over the last few gameweeks, the figures' heads name the gameweeks on
 *  hover. */
export function PlayersTable({
  leagueId,
  players,
  pointsSeason,
  period,
  periodGameweeks,
  stat,
  withStatus,
  shortlisted,
  sort,
  sortBy,
  selected,
  select,
}: {
  leagueId: Id<"leagues">;
  players: readonly ListedPlayer[];
  pointsSeason: number | null;
  period: Period;
  /** The gameweeks the period counts (the list's). */
  periodGameweeks: readonly number[];
  stat: CatalogueStat | null;
  /** Whether the Status column is drawn: in the All and Owned views. */
  withStatus: boolean;
  /** The codes on the manager's own shortlist, starred after the name. */
  shortlisted: ReadonlySet<number>;
  sort: ListSort;
  sortBy: (by: ListSortColumn) => void;
  selected: number | null;
  select: (player: ListedPlayer) => void;
}) {
  const shown: readonly Column[] = ["positions", "name", ...(withStatus ? (["owner"] as const) : []), ...FIGURES, ...(stat === null ? [] : (["stat"] as const))];
  const noPointsWords = period !== "season" ? noPeriodPointsWords : pointsSeason === null ? noPointsYetWords : notLastSeasonWords;
  return (
    <table className="w-full border-collapse">
      <ColumnHeads
        columns={{ ...columns, ...seasonColumns(pointsSeason), ...periodColumns(period, periodGameweeks), stat: statHead(stat) }}
        shown={shown}
        classOf={cellClasses}
        sort={{ ...sort, sortable: SORTABLE, sortBy }}
        deskRow
      />
      <tbody>
        {players.map((player) => (
          <tr
            key={player.code}
            aria-current={selected === player.code || undefined}
            onClick={() => select(player)}
            className="cursor-pointer border-t border-panel-rule aria-current:bg-name-plate aria-current:shadow-current-edge lg:h-row"
          >
            {shown.map((column) => (
              <PlayerCell key={column} column={column} player={player} noPointsWords={noPointsWords} leagueId={leagueId} shortlisted={shortlisted.has(player.code)} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The stat column's head: the shown stat's short code, named by its catalogue name. With no stat
 *  shown the column isn't drawn, and its head is the filter's own word. */
const statHead = (stat: CatalogueStat | null): ColumnWords =>
  stat === null ? { short: statLabel, long: statLabel } : { short: stat.shortCode, long: stat.name };

/** One cell of a player's row: his name heads it and opens his card; his position chip is a button
 *  that selects him for the keyboard, as a press anywhere on the row does. */
function PlayerCell({
  column,
  player,
  noPointsWords,
  leagueId,
  shortlisted,
}: {
  column: Column;
  player: ListedPlayer;
  /** Why a player with no points has none, on the "—"'s hover. */
  noPointsWords: string;
  leagueId: Id<"leagues">;
  shortlisted: boolean;
}) {
  const className = cellClasses(column);
  switch (column) {
    case "positions": {
      const main = cardOpensAt(player.positions);
      return (
        <td className={className} title={player.positions.join(", ")}>
          <button type="button" aria-label={selectPlayerLabel(player.name)} className="flex min-h-tap min-w-tap items-center lg:min-h-0 lg:min-w-0">
            {main === null ? noFigureWords : <PositionChip label={main} />}
          </button>
        </td>
      );
    }
    case "name":
      return (
        <th scope="row" title={player.fullName} className={`${className} font-normal`}>
          <span className="flex items-center gap-2">
            <Link to={playerCardPath(leagueId, player.code)} onClick={(event) => event.stopPropagation()} className="inline-flex min-h-tap min-w-tap items-center font-semibold text-lead lg:min-h-0 lg:min-w-0">
              {player.name}
            </Link>
            {shortlisted && <ShortlistStar label={shortlistedLabel} />}
            <span className="text-soft">
              <ClubMark code={player.club.code} />
              <ClubShort club={player.club} />
            </span>
          </span>
        </th>
      );
    case "owner":
      return (
        <td className={className}>
          {player.onWaivers === null ? <OwnerName teamName={player.ownerTeamName} /> : onWaiversWords(player.onWaivers.firstRun)}
        </td>
      );
    case "points":
      return player.points === null ? (
        <td title={noPointsWords} className={`${className} text-muted`}>
          {noFigureWords}
        </td>
      ) : (
        <td className={`${className} font-bold text-figure`}>{figureWords(player.points)}</td>
      );
    case "stat":
      return <td className={`${className} font-bold text-figure`}>{player.stat === null ? noFigureWords : statFigure(player.stat)}</td>;
    default:
      return <td className={`${className} font-bold text-figure`}>{figureWords(player.figures[column])}</td>;
  }
}
