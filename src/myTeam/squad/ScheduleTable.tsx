import type { PositionMark } from "../tactics/positionMarks";
import { ColumnHeads } from "../../ui/ColumnHeads";
import { PanelNote } from "../../ui/Panel";
import { PositionCodes } from "../../ui/PositionCodes";
import { MatchMark } from "../SquadCells";
import { PlayerCell, PlayerRow, squadCellClass, type Row } from "./SquadTable";
import { blankWeekWords, noScheduleWords, scheduleGameweekWords, scheduleTableLabel, squadColumns } from "./words";

/** The Schedule view (#1006; spec/12: "his next 6 fixtures"): each player's club's matches in the
 *  next six gameweeks, from the one being set (Craig, 6 Nov 2026). A blank week's cell is empty, a
 *  double week's holds both matches. Rows are the Stats view's, in its order, and a tap on one
 *  opens his season panel the same way. */
export function ScheduleTable({
  teamName,
  rows,
  gameweeks,
  starting,
  marks,
  selected,
  onSelect,
}: {
  teamName: string;
  rows: readonly Row[];
  gameweeks: readonly number[];
  starting: ReadonlySet<number> | null;
  marks: ReadonlyMap<number, readonly PositionMark[]>;
  selected: number | null;
  onSelect(code: number): void;
}) {
  if (gameweeks.length === 0) return <PanelNote>{noScheduleWords}</PanelNote>;
  const heads = {
    positions: squadColumns.positions,
    player: squadColumns.player,
    ...Object.fromEntries(gameweeks.map((gameweek) => [`gw${gameweek}`, scheduleGameweekWords(gameweek)])),
  };
  const classOf = (column: string) => squadCellClass(column === "positions" || column === "player");
  return (
    <div className="overflow-x-auto">
      <table aria-label={scheduleTableLabel(teamName)} className="w-full border-collapse">
        <ColumnHeads columns={heads} classOf={classOf} />
        <tbody>
          {rows.map((player) => (
            <PlayerRow key={player.code} code={player.code} isSelected={selected === player.code} onSelect={onSelect}>
              <td className={`${classOf("positions")} whitespace-nowrap`}>
                <PositionCodes positions={player.positions} spaced />
              </td>
              <PlayerCell
                className={classOf("player")}
                player={player}
                starts={starting === null || starting.has(player.code)}
                marks={marks.get(player.code) ?? []}
                isSelected={selected === player.code}
                onSelect={onSelect}
              />
              {gameweeks.map((gameweek) => (
                <GameweekCell key={gameweek} className={classOf(`gw${gameweek}`)} matches={player.schedule.filter((match) => match.gameweek === gameweek)} />
              ))}
            </PlayerRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** His club's matches in one gameweek: none in a blank week, two side by side in a double. */
function GameweekCell({ className, matches }: { className: string; matches: Row["schedule"] }) {
  if (matches.length === 0) {
    return (
      <td title={blankWeekWords} className={className}>
        <span className="sr-only">{blankWeekWords}</span>
      </td>
    );
  }
  return (
    <td className={className}>
      <span className="flex gap-px">
        {matches.map((match, index) => (
          <MatchMark key={index} match={match} />
        ))}
      </span>
    </td>
  );
}
