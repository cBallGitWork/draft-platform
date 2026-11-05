import type { Id } from "../../convex/_generated/dataModel";
import { useChange } from "../shared/useChange";
import { Loading, PANEL_BODY, Panel, Problem } from "../ui/Panel";
import type { LeagueSettingsSeam, TeamInOrder } from "./seam";
import { draftStartedWords, drawOrderWords, moveDownLabel, moveDownWords, moveUpLabel, moveUpWords, noTeamsWords, teamOrderHint, teamOrderLoadingWords, teamOrderTitle } from "./words";

/** The draft order (spec/04; Craig, 4 Nov 2026, on #1087 and #1089): the teams first pick first,
 *  each moved up or down a place at a time, or all drawn at random, as often as the commissioner
 *  likes until the draft starts. A move or a draw saves at once, apart from the settings' Save, as
 *  the order is the league's teams, not its rules. Once the draft has started, the order is fixed
 *  and offers neither. */
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
  return (
    <Panel title={teamOrderTitle}>
      <div className={PANEL_BODY}>
        <p className="text-muted">{started ? draftStartedWords : teamOrderHint}</p>
        {teams.length === 0 ? <p>{noTeamsWords}</p> : <TeamList teams={teams} busy={saving.busy} move={started ? null : move} />}
        {!started && teams.length > 1 && (
          <button type="button" disabled={saving.busy} onClick={() => void saving.run(() => seam.drawTeamOrder(leagueId))} className="secondary-action self-start">
            {drawOrderWords}
          </button>
        )}
        <Problem problem={saving.problem} />
      </div>
    </Panel>
  );
}

/** A move, held in its place but unseen, unread and untabbable where there is nowhere to move (the
 *  first team's Up), so the buttons stay in line; disabled while a move saves. */
function MoveButton({ label, shown, busy, onClick, children }: { label: string; shown: boolean; busy: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-hidden={!shown || undefined}
      disabled={busy || !shown}
      onClick={onClick}
      className={shown ? "secondary-action" : "secondary-action invisible"}
    >
      {children}
    </button>
  );
}

/** The teams first pick first, each with its moves, or none where `move` is null: a fixed order. */
function TeamList({ teams, busy, move }: { teams: TeamInOrder[]; busy: boolean; move: ((from: number, to: number) => void) | null }) {
  return (
    <ol className="flex flex-col">
      {teams.map(({ teamId, name }, place) => (
        <li key={teamId} className="flex items-center gap-3 border-b border-panel-rule py-1">
          <span className="w-6 text-right text-figure tabular-nums">{place + 1}</span>
          <span className="grow">{name}</span>
          {move !== null && (
            <>
              <MoveButton label={moveUpLabel(name)} shown={place > 0} busy={busy} onClick={() => move(place, place - 1)}>
                {moveUpWords}
              </MoveButton>
              <MoveButton label={moveDownLabel(name)} shown={place < teams.length - 1} busy={busy} onClick={() => move(place, place + 1)}>
                {moveDownWords}
              </MoveButton>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
