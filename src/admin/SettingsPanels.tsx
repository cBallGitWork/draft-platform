import { useState, type FormEvent } from "react";
import { PanelTitle } from "../frame/Panel";
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

// Approving a club whole, how starts count (spec/06, The admin oversees them), and when positions
// change (spec/06, When positions change).

export function ApproveClub({ queue, seam, change }: PanelProps) {
  const [chosen, choose] = useState<number | undefined>(undefined);
  const clubCode = chosen ?? queue.clubs[0]?.code;
  return (
    <section aria-labelledby="club-title" className="bg-panel">
      <PanelTitle id="club-title">{clubTitle}</PanelTitle>
      <div className="flex flex-wrap items-end gap-2 p-3">
        <span className="flex flex-col gap-1">
          <label htmlFor="approve-club" className="font-semibold">
            {clubLabel}
          </label>
          <select id="approve-club" value={clubCode} onChange={(event) => choose(Number(event.target.value))} className="text-box">
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
    </section>
  );
}

export function ApproveMode({ queue, seam, change }: PanelProps) {
  const other = queue.approveMode === "proposals" ? "countAtOnce" : "proposals";
  return (
    <section aria-labelledby="mode-title" className="bg-panel">
      <PanelTitle id="mode-title">{modeTitle}</PanelTitle>
      <div className="flex flex-col gap-2 p-3">
        <p>{modeWords[queue.approveMode]}</p>
        <button type="button" disabled={change.busy} onClick={() => void change.run(() => seam.setApproveMode(other))} className="secondary-action self-start">
          {switchModeWords[other]}
        </button>
      </div>
    </section>
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
    <section aria-labelledby="thresholds-title" className="bg-panel">
      <PanelTitle id="thresholds-title">{thresholdsTitle}</PanelTitle>
      <form onSubmit={save} className="flex flex-col gap-2 p-3">
        {fields.map((field) => (
          <span key={field.id} className="flex flex-col gap-1">
            <label htmlFor={field.id} className="font-semibold">
              {field.label}
            </label>
            <input
              id={field.id}
              type="number"
              required
              min={1}
              step={1}
              value={field.value}
              onChange={(event) => field.set(event.target.value)}
              className="text-box w-24"
            />
          </span>
        ))}
        <button type="submit" disabled={change.busy} className="secondary-action self-start">
          {saveThresholdsWords}
        </button>
      </form>
    </section>
  );
}
