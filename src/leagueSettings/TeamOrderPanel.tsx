import type { Id } from "../../convex/_generated/dataModel";
import { useChange } from "../shared/useChange";
import { cellClassOf, ColumnHeads } from "../ui/ColumnHeads";
import { Loading, PANEL_BODY, Panel, Problem, Status } from "../ui/Panel";
import { TickBox } from "../ui/TickBox";
import { MOVE_ACTION } from "./FixturesPanel";
import type { LeagueSettingsSeam, TeamInOrder } from "./seam";
import {
  draftStartedWords,
  drawOrderWords,
  iPickLabel,
  moveDownLabel,
  moveDownWords,
  moveUpLabel,
  moveUpWords,
  noTeamsWords,
  orderSavedWords,
  snakeWords,
  teamOrderColumns,
  teamOrderHint,
  teamOrderLoadingWords,
  teamOrderTitle,
} from "./words";

/** The draft order (spec/04; Craig, 4 Nov 2026, on #1087 and #1089), as its approved picture draws
 *  it (docs/design/approved/settings/1440-draft-order.png): the teams first pick first in a table,
 *  each moved up or down a place at a time, or all drawn at random, as often as the commissioner
 *  likes until the draft starts, and an "I'll pick" tick on each team with no manager, the mark the
 *  draft room's commissioner panel saves (spec/04). A move, a draw or a tick saves at once, apart
 *  from the settings' Save, and says "Saved". Once the draft has started, the order and the ticks
 *  are fixed. */
export function TeamOrderPanel({ leagueId, seam }: { leagueId: Id<"leagues">; seam: LeagueSettingsSeam }) {
  const order = seam.useTeamOrder(leagueId);
  const saving = useChange();
  if (order === undefined) {
    return (
      <Panel title={teamOrderTitle}>
        <Loading className="p-3">{teamOrderLoadingWords}</Loading>
      </Panel>
    );
  }
  const { teams, started } = order;
  function move(from: number, to: number) {
    const teamIds = teams.map((team) => team.teamId);
    [teamIds[from], teamIds[to]] = [teamIds[to], teamIds[from]];
    void saving.run(() => seam.saveTeamOrder(leagueId, teamIds));
  }
  const mark = (teamId: Id<"teams">, marked: boolean) => void saving.run(() => seam.markForCommissioner(leagueId, teamId, marked));
  return (
    <Panel title={teamOrderTitle} aside={<span className="text-soft">{snakeWords}</span>}>
      {teams.length === 0 ? (
        <p className="p-3">{noTeamsWords}</p>
      ) : (
        <TeamTable teams={teams} busy={saving.busy} move={started ? null : move} mark={started ? null : mark} />
      )}
      <div className={PANEL_BODY}>
        <div className="flex items-center gap-3">
          <p className="grow text-muted">{started ? draftStartedWords : teamOrderHint}</p>
          {!started && <Status words={saving.busy || saving.problem !== null ? null : orderSavedWords} className="text-soft" />}
          {!started && teams.length > 1 && (
            <button type="button" disabled={saving.busy} onClick={() => void saving.run(() => seam.drawTeamOrder(leagueId))} className="secondary-action">
              {drawOrderWords}
            </button>
          )}
        </div>
        <Problem problem={saving.problem} />
      </div>
    </Panel>
  );
}

/** A move, greyed where there is nowhere to move (the first team's Up), as the picture draws it, so
 *  the buttons stay in line; disabled while a change saves. */
function MoveButton({ label, shown, busy, onClick, children }: { label: string; shown: boolean; busy: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" aria-label={label} disabled={busy || !shown} onClick={onClick} className={MOVE_ACTION}>
      {children}
    </button>
  );
}

type Column = keyof typeof teamOrderColumns;
const COLUMNS = Object.keys(teamOrderColumns) as Column[];
/** Each column's cells, as the picture spaces them: the names on one line in a wide column, the
 *  tick a column of its own, and the moves taking what is left. */
const CELLS: Record<Column, string> = {
  place: `${cellClassOf(true)} w-10 text-figure tabular-nums`,
  team: `${cellClassOf(true)} w-56 whitespace-nowrap font-bold`,
  iPick: `${cellClassOf(true)} w-28 whitespace-nowrap`,
  moves: cellClassOf(true),
};

/** The teams first pick first, each with its "I'll pick" tick where it has no manager, and its
 *  moves; none where `move` is null, and the ticks fixed where `mark` is: a fixed order. */
function TeamTable({
  teams,
  busy,
  move,
  mark,
}: {
  teams: TeamInOrder[];
  busy: boolean;
  move: ((from: number, to: number) => void) | null;
  mark: ((teamId: Id<"teams">, marked: boolean) => void) | null;
}) {
  return (
    <table className="w-full border-collapse">
      <ColumnHeads columns={teamOrderColumns} shown={COLUMNS} unseen={["place", "moves"]} classOf={(column) => `${CELLS[column]} h-row`} />
      <tbody>
        {teams.map(({ teamId, name, commissionerPicks }, place) => (
          <tr key={teamId} className="h-tap border-b border-panel-rule">
            <td className={CELLS.place}>{place + 1}</td>
            <th scope="row" className={CELLS.team}>
              {name}
            </th>
            <td className={CELLS.iPick}>
              {commissionerPicks !== null && (
                <TickBox checked={commissionerPicks} disabled={busy || mark === null} labelHidden inTableRow onChange={(marked) => mark?.(teamId, marked)}>
                  {iPickLabel(name)}
                </TickBox>
              )}
            </td>
            <td className={CELLS.moves}>
              {move !== null && (
                <span className="flex gap-2">
                  <MoveButton label={moveUpLabel(name)} shown={place > 0} busy={busy} onClick={() => move(place, place - 1)}>
                    {moveUpWords}
                  </MoveButton>
                  <MoveButton label={moveDownLabel(name)} shown={place < teams.length - 1} busy={busy} onClick={() => move(place, place + 1)}>
                    {moveDownWords}
                  </MoveButton>
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
