import { useState } from "react";
import { PanelTitle } from "../frame/Panel";
import type { PanelProps } from "./panelProps";
import { approveClubWords, clubLabel, clubTitle, modeTitle, modeWords, switchModeWords } from "./words";

// Approving a club whole, and how starts count (spec/06, The admin oversees them).

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

