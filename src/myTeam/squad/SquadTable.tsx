import type { ReactNode } from "react";
import type { Position } from "../../../convex/positions/positionTables";
import type { SeasonStats } from "../../../convex/squads/teamSquad";
import { ClubMark, ClubShort } from "../../premierLeague/ClubName";
import { cellClassOf, ColumnHeads } from "../../ui/ColumnHeads";
import { Placeholder } from "../../ui/Placeholder";
import { PositionCodes } from "../../ui/PositionCodes";
import { unheldPlayerWords } from "../../shared/words";
import type { TeamSquad } from "../seam";
import { NextMatches, PointsCell } from "../SquadCells";
import { PositionMarks, type PositionMark } from "../tactics/positionMarks";
import { benchWords, figureWords, lastGameweekLong, noStatsWords, openPanelLabel, squadColumns, squadTableLabel, statusNotSettledLabel, goneWords } from "./words";

export type Row = TeamSquad["players"][number];
type Column = keyof typeof squadColumns;
type Stat = keyof SeasonStats;

/** The Stats view's columns, left to right (the approved picture): Next 3 at the far right. */
const STATS: readonly Stat[] = ["appearances", "minutes", "goals", "assists", "cleanSheets", "saves", "yellowCards", "redCards"];
const COLUMNS: readonly Column[] = ["number", "positions", "player", "season", "last", ...STATS, "next"];
/** Words on the left; every other column on the right, Next 3 too, as the picture has it. */
const WORDS: readonly Column[] = ["positions", "player"];
/** Saves are a keeper's: an outfield player's cell stays empty. */
const KEEPER = "GK" satisfies Position;

/** The squad's cells: the data's 20px line with 4px above and below, a 28px row on the desk
 *  (plate.md, Decided). */
export const squadCellClass = (words: boolean) => `${cellClassOf(words)} py-1`;
const cellClasses = (column: Column) => squadCellClass(WORDS.includes(column));

/** The Stats view (the approved picture): each player's season in one row, the bench's names
 *  muted, and a tap on a row opens his season panel. `rows` are in the table's order (squadOrder). */
export function SquadTable({
  teamName,
  rows,
  unheld,
  lastGameweek,
  starting,
  marks,
  selected,
  onSelect,
}: {
  teamName: string;
  rows: readonly Row[];
  unheld: readonly number[];
  lastGameweek: number | null;
  /** The eleven's codes; null while no lineup is open to set, when nobody is benched. */
  starting: ReadonlySet<number> | null;
  /** Each player's position marks, by his code (tactics/positionMarks.ts). */
  marks: ReadonlyMap<number, readonly PositionMark[]>;
  selected: number | null;
  onSelect(code: number): void;
}) {
  // The Last column's long word names the gameweek it shows, once there is one.
  const heads = lastGameweek === null ? squadColumns : { ...squadColumns, last: { ...squadColumns.last, long: lastGameweekLong(lastGameweek) } };
  return (
    <div className="overflow-x-auto">
      <table aria-label={squadTableLabel(teamName)} className="w-full border-collapse">
        <ColumnHeads columns={heads} shown={COLUMNS} classOf={cellClasses} />
        <tbody>
          {rows.map((player) => (
            <SquadRow key={player.code} player={player} starts={starting === null || starting.has(player.code)} marks={marks.get(player.code) ?? []} isSelected={selected === player.code} onSelect={onSelect} />
          ))}
          {/* Data gone wrong, kept so it shows (#323): there's no player to fill the columns. */}
          {unheld.map((code) => (
            <tr key={code} className="border-t border-panel-rule">
              <th scope="row" colSpan={COLUMNS.length} className={`${cellClasses("player")} text-event`}>
                {unheldPlayerWords(code)}
              </th>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SquadRow({ player, starts, marks, isSelected, onSelect }: { player: Row; starts: boolean; marks: readonly PositionMark[]; isSelected: boolean; onSelect(code: number): void }) {
  return (
    <PlayerRow code={player.code} isSelected={isSelected} onSelect={onSelect}>
      {COLUMNS.map((column) => (
        <SquadCell key={column} column={column} player={player} starts={starts} marks={marks} isSelected={isSelected} onSelect={onSelect} />
      ))}
    </PlayerRow>
  );
}

/** One cell of a player's row. His name is the row's button, for the keyboard and screen readers;
 *  a tap anywhere on the row does the same. */
function SquadCell({ column, player, starts, marks, isSelected, onSelect }: { column: Column; player: Row; starts: boolean; marks: readonly PositionMark[]; isSelected: boolean; onSelect(code: number): void }) {
  const className = cellClasses(column);
  switch (column) {
    case "number":
      return <td className={`${className} text-muted`}>{player.number ?? ""}</td>;
    case "positions":
      return (
        <td className={`${className} whitespace-nowrap`}>
          <PositionCodes positions={player.positions} spaced />
        </td>
      );
    case "player":
      return <PlayerCell className={className} player={player} starts={starts} marks={marks} isSelected={isSelected} onSelect={onSelect} />;
    case "season":
      return <PointsCell className={className} points={player.seasonPoints} />;
    case "last":
      return <PointsCell className={className} points={player.lastGameweekPoints} />;
    case "next":
      return (
        <td className={className}>
          <NextMatches matches={player.nextFixtures} />
        </td>
      );
    default:
      return <StatCell className={className} stat={column} player={player} />;
  }
}

/** A player's row in any of the table's views: a tap on it opens his season panel. */
export function PlayerRow({ code, isSelected, onSelect, children }: { code: number; isSelected: boolean; onSelect(code: number): void; children: ReactNode }) {
  return (
    <tr
      onClick={() => onSelect(code)}
      aria-current={isSelected || undefined}
      className="cursor-pointer border-t border-panel-rule aria-current:bg-name-plate aria-current:shadow-current-edge"
    >
      {children}
    </tr>
  );
}

/** His name, the row's button for the keyboard and screen readers, muted on the bench, with his
 *  club, his status chip's place, his position marks, and whether he has left the league. */
export function PlayerCell({ className, player, starts, marks, isSelected, onSelect }: { className: string; player: Row; starts: boolean; marks: readonly PositionMark[]; isSelected: boolean; onSelect(code: number): void }) {
  return (
    <th scope="row" title={player.fullName} className={`${className} whitespace-nowrap`}>
      <button
        type="button"
        aria-expanded={isSelected}
        aria-label={openPanelLabel(player.name)}
        onClick={(event) => {
          // The row's own tap would select him a second time.
          event.stopPropagation();
          onSelect(player.code);
        }}
        className={`inline-flex min-h-tap min-w-tap items-center text-lead font-semibold lg:min-h-0 lg:min-w-0 ${starts ? "text-fact" : "text-muted"}`}
      >
        {player.name}
        {!starts && <span className="sr-only">, {benchWords}</span>}
      </button>{" "}
      <span className="text-muted">
        <ClubMark code={player.club.code} />
        <ClubShort club={player.club} />
      </span>
      {player.chanceOfPlaying !== null && (
        <>
          {" "}
          <Placeholder label={statusNotSettledLabel} className="size-3 align-middle" />
        </>
      )}
      <PositionMarks marks={marks} />
      {player.gone && <span className="block font-normal text-event">{goneWords}</span>}
    </th>
  );
}

function StatCell({ className, stat, player }: { className: string; stat: Stat; player: Row }) {
  if (stat === "saves" && !player.positions.includes(KEEPER)) return <td className={className} />;
  if (player.stats === null) {
    return (
      <td className={className}>
        <Placeholder label={noStatsWords} className="h-4 w-full" />
      </td>
    );
  }
  return <td className={className}>{figureWords(player.stats[stat])}</td>;
}
