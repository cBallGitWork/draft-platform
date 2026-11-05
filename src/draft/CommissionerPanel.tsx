import { useId, useState, type FormEvent } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { Change } from "../shared/refusal";
import { useChange } from "../shared/useChange";
import { Loading, PANEL_BODY, Panel, Problem } from "../ui/Panel";
import { pickInRoundOf, roundOf } from "./board";
import type { CommissionerView, DraftBoard, DraftSeam, DraftState } from "./seam";
import {
  badPickTimeWords,
  COMMISSIONER_TITLE,
  lastPickWords,
  loadingWords,
  lostPlayerWords,
  onlyYouWords,
  pauseWords,
  pickForTeamWords,
  pickTimeLabel,
  pickTimeWords,
  resumeWords,
  slotWords,
  startNowWords,
  stopPickingForWords,
  undoLastWords,
  unmanagedWords,
  whilePausedWords,
  youPickForWords,
} from "./words";

// The draft room's commissioner panel (spec/04, Starting it and The commissioner; #1101), built to
// the approved pictures (docs/design/approved/draft-room/), seen only by whoever runs the league.
// Before the start: start the draft now, "I'll pick for" each team with no manager, and the pick
// time, which changes League settings' (Craig, 5 Nov 2026, on #1101). While it runs: pause or
// resume, undo the last pick, and the pick time, changed only while paused. "Pick for <team>" waits
// for the players list (#1099), and "Change the start" for a home for the start date.

type Waiting = Extract<DraftState, { status: "waiting" }>;
type Live = Extract<DraftState, { status: "live" }>;

export function CommissionerPanel({ leagueId, seam, draft, board, now }: { leagueId: Id<"leagues">; seam: DraftSeam; draft: Waiting | Live; board: DraftBoard; now: number }) {
  const view = seam.useCommissioner(leagueId, now);
  const changes = seam.useCommissionerChanges();
  const changing = useChange();
  const aside = <span className="text-soft">{onlyYouWords}</span>;
  if (view === undefined) {
    return (
      <Panel title={COMMISSIONER_TITLE} aside={aside}>
        <Loading className="p-3">{loadingWords}</Loading>
      </Panel>
    );
  }
  const run = (change: () => Change) => void changing.run(change);
  const paused = draft.status === "live" && draft.clock?.pausedAt !== undefined;
  return (
    <Panel title={COMMISSIONER_TITLE} aside={aside}>
      <div className={PANEL_BODY}>
        {draft.status === "waiting" ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Action disabled={changing.busy} onClick={() => run(() => changes.start(leagueId))}>
                {startNowWords}
              </Action>
            </div>
            <Unmanaged teams={view.unmanaged} busy={changing.busy} mark={(teamId, marked) => run(() => changes.markForCommissioner(leagueId, teamId, marked))} />
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Action disabled={changing.busy} onClick={() => run(() => (paused ? changes.resume(leagueId) : changes.pause(leagueId)))}>
                {paused ? resumeWords : pauseWords}
              </Action>
              <Action disabled={changing.busy || board.picks.length === 0} onClick={() => run(() => changes.undo(leagueId))}>
                {undoLastWords}
              </Action>
            </div>
            <LastPick draft={draft} board={board} />
          </>
        )}
        <PickTime
          seconds={view.pickSeconds}
          open={draft.status === "waiting" || paused}
          busy={changing.busy}
          save={(pickSeconds) => changing.run(() => changes.setPickTime(leagueId, pickSeconds))}
        />
        <Problem problem={changing.problem} />
      </div>
    </Panel>
  );
}

function Action({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="secondary-action">
      {children}
    </button>
  );
}

/** Each team with no manager: on auto-pick unless he picks for it, and his button to say so or stop. */
function Unmanaged({ teams, busy, mark }: { teams: CommissionerView["unmanaged"]; busy: boolean; mark: (teamId: Id<"teams">, marked: boolean) => void }) {
  return teams.map(({ teamId, name, marked }) => (
    <div key={teamId} className="flex flex-col items-start gap-1">
      <Action disabled={busy} onClick={() => mark(teamId, !marked)}>
        {marked ? stopPickingForWords(name) : pickForTeamWords(name)}
      </Action>
      <p className="text-soft">{marked ? youPickForWords(name) : unmanagedWords(name)}</p>
    </div>
  ));
}

/** Who made the last pick, whom they took, and its slot: "Last pick: Show Me Your Moyes took Gordon NEW, 4.02". */
function LastPick({ draft, board }: { draft: Live; board: DraftBoard }) {
  const last = board.picks.at(-1);
  if (last === undefined) return null;
  const team = draft.order.find((each) => each.teamId === last.teamId)?.name ?? "";
  const teams = draft.order.length;
  const player = last.player === null ? lostPlayerWords : `${last.player.name} ${last.player.clubShortName}`;
  return <p className="text-soft">{lastPickWords(team, player, slotWords(roundOf(last.pick, teams), pickInRoundOf(last.pick, teams)))}</p>;
}

const UNITS: Record<string, number> = { "": 1, s: 1, m: 60, h: 3600 };

/** A typed pick time in seconds, "90s", "2m", "8h" or a bare 90; null for anything else. */
function secondsFrom(typed: string): number | null {
  const found = /^\s*(\d+(?:\.\d+)?)\s*([smh]?)\s*$/i.exec(typed);
  return found === null ? null : Math.round(Number(found[1]) * UNITS[found[2].toLowerCase()]);
}

/** The pick time's box: typed as "90s", "2m" or "8h" and saved on Enter or on leaving it, where
 *  `open`; otherwise greyed, to be changed while paused. */
function PickTime({ seconds, open, busy, save }: { seconds: number | null; open: boolean; busy: boolean; save: (seconds: number) => Promise<boolean> }) {
  const id = useId();
  const shown = seconds === null ? "" : pickTimeWords(seconds);
  const [typed, setTyped] = useState(shown);
  const [held, setHeld] = useState(shown);
  const [bad, setBad] = useState(false);
  // The time last sent, so leaving the box after Enter doesn't send it again.
  const [sent, setSent] = useState(seconds);
  if (held !== shown) {
    setHeld(shown);
    setTyped(shown);
    setSent(seconds);
  }
  function submit(event?: FormEvent) {
    event?.preventDefault();
    const next = secondsFrom(typed);
    setBad(next === null);
    if (next === null || next === sent) return;
    setSent(next);
    void save(next).then((saved) => {
      if (saved) return;
      setTyped(shown);
      setSent(seconds);
    });
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <label htmlFor={id} className="text-soft">
          {pickTimeLabel}
        </label>
        <input
          id={id}
          value={typed}
          disabled={!open || busy}
          onChange={(event) => setTyped(event.target.value)}
          onBlur={() => submit()}
          className="text-box w-number-box"
        />
        {!open && <span className="text-soft">{whilePausedWords}</span>}
      </div>
      <Problem problem={bad ? badPickTimeWords : null} />
    </form>
  );
}
