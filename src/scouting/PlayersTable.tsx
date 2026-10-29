import { Link } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import type { CatalogueStat } from "../../convex/scoring/statCatalogue";
import { playerCardPath } from "../playerCard/paths";
import { TickBox } from "../ui/TickBox";
import { PositionCodes } from "../ui/PositionCodes";
import { cellClassOf } from "../ui/ColumnHeads";
import { OwnerName } from "../ui/OwnerName";
import { ClubShort } from "../premierLeague/ClubName";
import type { PickedPlayer } from "./ComparePanel";
import { statFigure } from "./figures";
import type { ListedPlayer, PlayersSort, SortColumn } from "./seam";
import {
  ascendingGlyph,
  columns,
  compareLabel,
  descendingGlyph,
  noFigureWords,
  noPointsYetWords,
  noRoleFitYetWords,
  sortByLabel,
} from "./words";

/** The list's columns: the fixed ones, and "stat" for the shown stat's season total. */
type Column = keyof typeof columns | "stat";
const COLUMNS: readonly Column[] = ["compare", "name", "club", "positions", "owner", "seasonPoints", "roleFit"];
const SORTED_BY: Partial<Record<Column, SortColumn>> = { name: "name", club: "club", seasonPoints: "seasonPoints", stat: "stat" };
/** Columns a phone leaves out, for room: the filters say who owns whom. */
const DESK_ONLY: readonly Column[] = ["owner", "roleFit"];
const FIGURES: readonly Column[] = ["seasonPoints", "roleFit", "stat"];

/** A column's cells: names read from the left, figures line up on the right, and a phone leaves
 *  out what it has no room for. */
const cellClasses = (column: Column) =>
  cellClassOf(!FIGURES.includes(column), DESK_ONLY.includes(column));

/** The players list itself: a head per column, sortable where it can be, and a row per player. */
export function PlayersTable({
  leagueId,
  players,
  stat,
  sort,
  sortBy,
  picked,
  pick,
}: {
  leagueId: Id<"leagues">;
  players: readonly ListedPlayer[];
  stat: CatalogueStat | null;
  sort: PlayersSort;
  sortBy: (by: SortColumn) => void;
  picked: readonly PickedPlayer[];
  pick: (player: ListedPlayer, ticked: boolean) => void;
}) {
  const shown: readonly Column[] = stat === null ? COLUMNS : [...COLUMNS, "stat"];
  return (
    <table className="w-full border-collapse">
      <thead className="bg-head text-ground">
        <tr>
          {shown.map((column) => (
            <ColumnHead key={column} column={column} stat={stat} sort={sort} sortBy={sortBy} />
          ))}
        </tr>
      </thead>
      <tbody>
        {players.map((player) => (
          <tr key={player.code} className="border-t border-panel-rule">
            {shown.map((column) => (
              <PlayerCell
                key={column}
                column={column}
                player={player}
                leagueId={leagueId}
                ticked={picked.some((each) => each.code === player.code)}
                pick={pick}
              />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A column's head: its short code, the full name on hover (the shown stat's from the catalogue); a
 *  sortable one is a button, and the column sorted by says which way. */
function ColumnHead({
  column,
  stat,
  sort,
  sortBy,
}: {
  column: Column;
  stat: CatalogueStat | null;
  sort: PlayersSort;
  sortBy: (by: SortColumn) => void;
}) {
  const { short, long } = column === "stat" ? { short: stat!.shortCode, long: stat!.name } : columns[column];
  const by = SORTED_BY[column];
  const sorted = by !== undefined && by === sort.by;
  return (
    <th
      scope="col"
      title={long}
      aria-sort={sorted ? (sort.descending ? "descending" : "ascending") : undefined}
      className={cellClasses(column)}
    >
      {by === undefined ? (
        short
      ) : (
        <button type="button" aria-label={sortByLabel(long)} onClick={() => sortBy(by)} className="min-h-tap font-bold">
          {short}
          {sorted && <span aria-hidden="true"> {sort.descending ? descendingGlyph : ascendingGlyph}</span>}
        </button>
      )}
    </th>
  );
}

/** One cell of a player's row: his name heads it, his points are its figure. */
function PlayerCell({
  column,
  player,
  leagueId,
  ticked,
  pick,
}: {
  column: Column;
  player: ListedPlayer;
  leagueId: Id<"leagues">;
  ticked: boolean;
  pick: (player: ListedPlayer, ticked: boolean) => void;
}) {
  const className = cellClasses(column);
  switch (column) {
    case "compare":
      return (
        <td className={className}>
          <TickBox checked={ticked} onChange={(checked) => pick(player, checked)}>
            <span className="sr-only">{compareLabel(player.name)}</span>
          </TickBox>
        </td>
      );
    case "name":
      return (
        <th scope="row" title={player.fullName} className={`${className} text-lead font-semibold`}>
          <Link to={playerCardPath(leagueId, player.code)} className="flex min-h-tap items-center">
            {player.name}
          </Link>
        </th>
      );
    case "club":
      return (
        <td className={className}>
          <ClubShort club={player.club} />
        </td>
      );
    case "positions":
      return (
        <td className={className}>
          <PositionCodes positions={player.positions} />
        </td>
      );
    case "owner":
      return (
        <td className={className}>
          <OwnerName teamName={player.ownerTeamName} />
        </td>
      );
    case "seasonPoints":
      return player.seasonPoints === null ? (
        <td title={noPointsYetWords} className={`${className} text-muted`}>
          {noFigureWords}
        </td>
      ) : (
        <td className={`${className} font-bold text-figure`}>{player.seasonPoints}</td>
      );
    case "stat":
      return <td className={`${className} font-bold text-figure`}>{player.stat === null ? noFigureWords : statFigure(player.stat)}</td>;
    case "roleFit":
      // Role stars show for every player until scouts exist (spec/19, Role stars); roles aren't
      // built yet, so none has any.
      return (
        <td title={noRoleFitYetWords} className={`${className} text-muted`}>
          {noFigureWords}
        </td>
      );
  }
}
