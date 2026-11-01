import { Fragment } from "react";
import type { Position } from "../../../convex/positions/positionTables";
import type { SeasonStats } from "../../../convex/squads/teamSquad";
import { ClubShort } from "../../premierLeague/ClubName";
import { cellClassOf, ColumnHeads } from "../../ui/ColumnHeads";
import { Placeholder } from "../../ui/Placeholder";
import { PositionCode } from "../../ui/PositionCodes";
import { unheldPlayerWords } from "../../shared/words";
import type { TeamSquad } from "../seam";
import {
  benchWords,
  difficultyNotRatedWords,
  figureWords,
  lastGameweekLong,
  nextFixtureLong,
  nextFixtureShort,
  noFigureWords,
  noNextFixtureWords,
  noPointsWords,
  noStatsWords,
  openPanelLabel,
  shortThenLongName,
  squadColumns,
  squadTableLabel,
  statusNotSettledLabel,
  whenWords,
  goneWords,
} from "./words";

export type Row = TeamSquad["players"][number];
type Column = keyof typeof squadColumns;
type Stat = keyof SeasonStats;

/** The Stats view's columns, left to right (the approved picture): Next 3 at the far right. */
const STATS: readonly Stat[] = ["appearances", "minutes", "goals", "assists", "cleanSheets", "saves", "yellowCards", "redCards"];
const COLUMNS: readonly Column[] = ["number", "positions", "player", "season", "last", ...STATS, "next"];
/** Words on the left; every other column is figures, on the right. */
const WORDS: readonly Column[] = ["positions", "player", "next"];
/** Saves are a keeper's: an outfield player's cell stays empty. */
const KEEPER = "GK" satisfies Position;

/** The squad's cells: the data's 20px line with 4px above and below, a 28px row on the desk
 *  (plate.md, Decided). */
const cellClasses = (column: Column) => `${cellClassOf(WORDS.includes(column))} py-1`;

/** The Stats view (the approved picture): each player's season in one row, the bench's names
 *  muted, and a tap on a row opens his season panel. `rows` are in the table's order (squadOrder). */
export function SquadTable({
  teamName,
  rows,
  unheld,
  lastGameweek,
  starting,
  selected,
  onSelect,
}: {
  teamName: string;
  rows: readonly Row[];
  unheld: readonly number[];
  lastGameweek: number | null;
  /** The eleven's codes; null while no lineup is open to set, when nobody is benched. */
  starting: ReadonlySet<number> | null;
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
            <SquadRow key={player.code} player={player} starts={starting === null || starting.has(player.code)} isSelected={selected === player.code} onSelect={onSelect} />
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

function SquadRow({ player, starts, isSelected, onSelect }: { player: Row; starts: boolean; isSelected: boolean; onSelect(code: number): void }) {
  return (
    <tr
      onClick={() => onSelect(player.code)}
      aria-current={isSelected || undefined}
      className="cursor-pointer border-t border-panel-rule aria-current:bg-name-plate aria-current:shadow-current-edge"
    >
      {COLUMNS.map((column) => (
        <SquadCell key={column} column={column} player={player} starts={starts} isSelected={isSelected} onSelect={onSelect} />
      ))}
    </tr>
  );
}

/** One cell of a player's row. His name is the row's button, for the keyboard and screen readers;
 *  a tap anywhere on the row does the same. */
function SquadCell({ column, player, starts, isSelected, onSelect }: { column: Column; player: Row; starts: boolean; isSelected: boolean; onSelect(code: number): void }) {
  const className = cellClasses(column);
  switch (column) {
    case "number":
      return <td className={`${className} text-muted`}>{player.number ?? ""}</td>;
    case "positions":
      return (
        <td className={`${className} whitespace-nowrap`}>
          <PositionList positions={player.positions} />
        </td>
      );
    case "player":
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
            <ClubShort club={player.club} />
          </span>
          {player.chanceOfPlaying !== null && (
            <>
              {" "}
              <Placeholder label={statusNotSettledLabel} className="size-3 align-middle" />
            </>
          )}
          {player.gone && <span className="block font-normal text-event">{goneWords}</span>}
        </th>
      );
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

/** Every position he holds, his main first, side by side as the picture's chips are: a space
 *  between them for screen readers, which the row's gap draws. */
export function PositionList({ positions }: { positions: readonly Position[] }) {
  return (
    <span className="flex gap-1">
      {positions.map((position, index) => (
        <Fragment key={position}>
          {index > 0 && " "}
          <PositionCode position={position} />
        </Fragment>
      ))}
    </span>
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

function PointsCell({ className, points }: { className: string; points: number | null }) {
  return points === null ? (
    <td title={noPointsWords} className={`${className} text-muted`}>
      {noFigureWords}
    </td>
  ) : (
    <td className={`${className} font-bold text-figure`}>{figureWords(points)}</td>
  );
}

/** His club's next matches, each a cell whose fill waits for fixture difficulty (the README's
 *  placeholders), so it is the placeholder's outline round the match. */
export function NextMatches({ matches }: { matches: Row["nextFixtures"] }) {
  if (matches.length === 0) {
    return (
      <span title={noNextFixtureWords} className="text-muted">
        {noFigureWords}
      </span>
    );
  }
  return (
    <span className="flex gap-px">
      {matches.map((match) => {
        const short = nextFixtureShort(match.opponent.shortName, match.home);
        const long = `${nextFixtureLong(match.opponent.name, match.home, whenWords(match.kickoff))}, ${difficultyNotRatedWords}`;
        return (
          <abbr key={match.kickoff} title={long} aria-label={shortThenLongName({ short, long })} className="grow basis-0 border border-muted px-1 text-center whitespace-nowrap no-underline">
            {short}
          </abbr>
        );
      })}
    </span>
  );
}
