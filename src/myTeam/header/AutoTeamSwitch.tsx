import { useId, useState } from "react";
import type { LeagueSummary } from "../../../convex/leagues/myLeagues";
import { menuGlyph } from "../../shared/words";
import { Panel, PANEL_BODY, Problem } from "../../ui/Panel";
import type { MyAutoTeam, MyTeamSeam } from "../seam";
import {
  autoTeamHead,
  autoTeamStateWords,
  autoTeamWhatWords,
  cancelWords,
  endGameweekLabel,
  gameweekShort,
  switchOffWords,
  switchOnWords,
  untilEndOfWords,
  untilSwitchedOffWords,
} from "./words";

// The Auto team reading on My team's header band (spec/09, The auto team; the approved auto-team
// picture): Off, or On and until when, opening the Auto team panel under it. Off, the panel offers
// until the end of a gameweek, from the next not begun, or until the manager switches it off
// ("like CM's holiday"); on, it switches it off.

/** The reading's value: a button opening the panel. Its drop-down lists the gameweeks the league
 *  plays, from the next not begun to its last (`endGameweeks`), so a league that ends early offers
 *  none after it (spec/13, Gameweeks); with none left, no end can be named. */
export function AutoTeamSwitch({ league, seam }: { league: LeagueSummary; seam: MyTeamSeam }) {
  const autoTeam = seam.useMyAutoTeam(league.leagueId);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (autoTeam === undefined) return null;
  return (
    <span className="relative">
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)} className="inline-flex min-h-tap min-w-tap items-center gap-1 lg:min-h-0 lg:min-w-0">
        {autoTeamStateWords(autoTeam)} <span aria-hidden="true">{menuGlyph}</span>
      </button>
      {open && (
        <div id={panelId} className="absolute top-full right-0 z-10 w-auto-team-panel bg-panel-solid font-normal shadow-bevel-panel">
          <AutoTeamPanel league={league} seam={seam} autoTeam={autoTeam} close={() => setOpen(false)} />
        </div>
      )}
    </span>
  );
}

/** Until when, as the panel's choice holds it: the end of a gameweek, or until switched off. */
type Until = "gameweek" | "off";

function AutoTeamPanel({ league, seam, autoTeam, close }: { league: LeagueSummary; seam: MyTeamSeam; autoTeam: MyAutoTeam; close: () => void }) {
  const changes = seam.useAutoTeamChanges();
  const { endGameweeks } = autoTeam;
  const firstGameweek = endGameweeks[0];
  const [until, setUntil] = useState<Until>(firstGameweek === undefined ? "off" : "gameweek");
  const [endsAfter, setEndsAfter] = useState(firstGameweek);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const name = useId();

  const commit = async () => {
    setBusy(true);
    const refused = await changes.set(league.leagueId, autoTeam.teamId, !autoTeam.on, !autoTeam.on && until === "gameweek" ? endsAfter : undefined);
    setBusy(false);
    if (refused === null) close();
    else setProblem(refused);
  };

  return (
    <Panel title={autoTeamHead}>
      <div className={PANEL_BODY}>
        <p>{autoTeamWhatWords}</p>
        {!autoTeam.on && (
          <div role="radiogroup" aria-label={autoTeamHead} className="flex flex-col gap-1">
            {firstGameweek !== undefined && (
              <span className="flex min-h-tap items-center gap-3">
                <label className="flex cursor-pointer items-center gap-3">
                  <input type="radio" name={name} className="radio-well" checked={until === "gameweek"} onChange={() => setUntil("gameweek")} />
                  {untilEndOfWords}
                </label>
                <select
                  aria-label={endGameweekLabel}
                  value={endsAfter}
                  onChange={(event) => {
                    setEndsAfter(Number(event.target.value));
                    setUntil("gameweek");
                  }}
                  className="text-box"
                >
                  {endGameweeks.map((gameweek) => (
                    <option key={gameweek} value={gameweek}>
                      {gameweekShort(gameweek)}
                    </option>
                  ))}
                </select>
              </span>
            )}
            <label className="flex min-h-tap cursor-pointer items-center gap-3">
              <input type="radio" name={name} className="radio-well" checked={until === "off"} onChange={() => setUntil("off")} />
              {untilSwitchedOffWords}
            </label>
          </div>
        )}
        <Problem problem={problem} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={close} className="secondary-action">
            {cancelWords}
          </button>
          <button type="button" disabled={busy} onClick={() => void commit()} className="action">
            {autoTeam.on ? switchOffWords : switchOnWords}
          </button>
        </div>
      </div>
    </Panel>
  );
}
