import { useState, type FormEvent } from "react";
import { PANEL_BODY, Panel } from "../ui/Panel";
import type { PanelProps } from "./panelProps";
import {
  approveClubWords,
  clubLabel,
  clubTitle,
  flagAfterLabel,
  modeTitle,
  modeWords,
  removeAfterLabel,
  saveThresholdsWords,
  switchModeWords,
  thresholdsTitle,
} from "./words";

const CLUB_ID = "approve-club";

// Approving a club whole, how starts count (spec/06, The admin oversees them), and when positions
// change (spec/06, When positions change).

export function ApproveClub({ queue, seam, change }: PanelProps) {
  const [chosen, choose] = useState<number | undefined>(undefined);
  const clubCode = chosen ?? queue.clubs[0]?.code;
  return (
    <Panel title={clubTitle}>
      <div className="flex flex-wrap items-end gap-2 p-3">
        <span className="flex flex-col gap-1">
          <label htmlFor={CLUB_ID} className="font-semibold">
            {clubLabel}
          </label>
          <select id={CLUB_ID} value={clubCode} onChange={(event) => choose(Number(event.target.value))} className="text-box">
            {queue.clubs.map((club) => (
              <option key={club.code} value={club.code}>
                {club.name}
              </option>
            ))}
          </select>
        </span>
        <button
          type="button"
          disabled={change.busy || clubCode === undefined}
          onClick={() => clubCode !== undefined && void change.run(() => seam.approveClub(clubCode))}
          className="secondary-action"
        >
          {approveClubWords}
        </button>
      </div>
    </Panel>
  );
}

export function ApproveMode({ queue, seam, change }: PanelProps) {
  const other = queue.approveMode === "proposals" ? "countAtOnce" : "proposals";
  return (
    <Panel title={modeTitle}>
      <div className={PANEL_BODY}>
        <p>{modeWords[queue.approveMode]}</p>
        <button type="button" disabled={change.busy} onClick={() => void change.run(() => seam.setApproveMode(other))} className="secondary-action self-start">
          {switchModeWords[other]}
        </button>
      </div>
    </Panel>
  );
}

/** The thresholds a run of starts elsewhere flags, then removes, a position at; the server says
 *  why a pair is refused. */
export function Thresholds({ queue, seam, change }: PanelProps) {
  const [flagAfter, setFlagAfter] = useState(String(queue.thresholds.flagAfter));
  const [removeAfter, setRemoveAfter] = useState(String(queue.thresholds.removeAfter));
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void change.run(() => seam.setChangeThresholds({ flagAfter: Number(flagAfter), removeAfter: Number(removeAfter) }));
  }
  const fields = [
    { id: "flag-after", label: flagAfterLabel, value: flagAfter, set: setFlagAfter },
    { id: "remove-after", label: removeAfterLabel, value: removeAfter, set: setRemoveAfter },
  ];
  return (
    <Panel title={thresholdsTitle}>
      <form onSubmit={save} className={PANEL_BODY}>
        {fields.map((field) => (
          <span key={field.id} className="flex flex-col gap-1">
            <label htmlFor={field.id} className="font-semibold">
              {field.label}
            </label>
            <input
              id={field.id}
              type="number"
              required
              value={field.value}
              onChange={(event) => field.set(event.target.value)}
              className="text-box w-wide-number-box"
            />
          </span>
        ))}
        <button type="submit" disabled={change.busy} className="secondary-action self-start">
          {saveThresholdsWords}
        </button>
      </form>
    </Panel>
  );
}
