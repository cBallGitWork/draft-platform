import { useId } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { ScreenTeam } from "./seam";
import { menuGlyph } from "../shared/words";
import { noteLabel, NOTE_MOST, partnerLabel } from "./words";

// The New offer tab's two controls besides its ticks (docs/design/approved/trades/1440-new.png):
// the team to trade with, in Their squad's plate, and the offer's one-line note.

/** The team to trade with, and its squad's count beside it; locked on a counter. A flat box with
 *  its ▾ at the title bar's height on the desk, so Their squad's plate is as tall as Your squad's
 *  and both tables start on one line; a phone keeps the tap size. */
export function PartnerPicker({
  partners,
  partnerId,
  choose,
  locked,
  count,
}: {
  partners: readonly ScreenTeam[];
  partnerId: Id<"teams"> | null;
  choose: (teamId: Id<"teams">) => void;
  locked: boolean;
  count: string | null;
}) {
  if (partners.length === 0) return undefined;
  return (
    <span className="flex items-baseline gap-3">
      <span className="relative flex items-center lg:-my-1">
        <select
          aria-label={partnerLabel}
          value={partnerId ?? ""}
          disabled={locked}
          onChange={(event) => {
            const team = partners.find(
              ({ teamId }) => teamId === event.target.value,
            );
            if (team !== undefined) choose(team.teamId);
          }}
          className="text-box appearance-none pr-6 font-semibold lg:min-h-bar-control lg:w-partner-picker"
        >
          {partners.map((team) => (
            <option key={team.teamId} value={team.teamId}>
              {team.teamName}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="pointer-events-none absolute right-2">
          {menuGlyph}
        </span>
      </span>
      {count !== null && <span className="text-soft">{count}</span>}
    </span>
  );
}

/** The offer's one-line note. */
export function NoteBox({
  note,
  setNote,
}: {
  note: string;
  setNote: (note: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1 border-b border-panel-rule px-3 py-2">
      <label htmlFor={id} className="text-soft">
        {noteLabel}
      </label>
      <input
        id={id}
        type="text"
        value={note}
        maxLength={NOTE_MOST}
        onChange={(event) => setNote(event.target.value)}
        className="text-box"
      />
    </div>
  );
}
