import { ClubMark, ClubShort } from "../ui/ClubName";
import { ColumnHeads } from "../ui/ColumnHeads";
import { PositionChip } from "../ui/PositionChip";
import { TickBox } from "../ui/TickBox";
import type { ScreenTeam } from "./seam";
import { groupWords, squadColumns, squadTableLabel, tickLabel } from "./words";

type Column = keyof typeof squadColumns;
const COLUMNS = Object.keys(squadColumns) as Column[];
const HEAD_CLASSES: Record<Column, string> = {
  tick: "w-tap px-2",
  position: "px-2 text-left",
  player: "px-2 text-left",
};

/** A squad on the New offer tab (docs/design/approved/trades/1440-new.png), a tick on each player:
 *  one held in a trade under review is greyed with "In review" and can't be ticked. */
export function SquadTable({
  team,
  ticked,
  tick,
}: {
  team: ScreenTeam;
  ticked: readonly number[];
  tick: (codes: readonly number[]) => void;
}) {
  return (
    <table
      aria-label={squadTableLabel(team.teamName)}
      className="w-full border-collapse"
    >
      <ColumnHeads
        columns={squadColumns}
        shown={COLUMNS}
        classOf={(column) => HEAD_CLASSES[column]}
        unseen={["tick"]}
      />
      <tbody>
        {team.players.map((player) => {
          const on = ticked.includes(player.code);
          return (
            <tr
              key={player.code}
              className={`h-row border-t border-panel-rule${on ? " bg-name-plate shadow-current-edge" : ""}`}
            >
              <td className="px-2">
                <TickBox
                  checked={on}
                  disabled={player.held}
                  labelHidden
                  inTableRow
                  onChange={(checked) =>
                    tick(
                      checked
                        ? [...ticked, player.code]
                        : ticked.filter((code) => code !== player.code),
                    )
                  }
                >
                  {tickLabel(player.name)}
                </TickBox>
              </td>
              <td className="px-2">
                {player.position === null ? null : (
                  <PositionChip label={player.position} dimmed={player.held} />
                )}
              </td>
              <th scope="row" className="px-2 text-left">
                <span
                  className={`inline-flex items-center gap-2${player.held ? " text-muted" : ""}`}
                >
                  <span className="font-semibold">{player.name}</span>
                  <span className="inline-flex items-center text-soft">
                    <ClubMark code={player.club.code} />
                    <ClubShort club={player.club} />
                  </span>
                  {player.held && (
                    <span className="bg-head px-1 text-ground">
                      {groupWords.inReview}
                    </span>
                  )}
                </span>
              </th>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
