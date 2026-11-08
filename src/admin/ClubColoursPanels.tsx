import { useState, type FormEvent } from "react";
import { UNSET_COLOURS, type Colours, type Pattern } from "../../convex/football/clubColours";
import { useChoiceAmong } from "../shared/useChoiceAmong";
import { PANEL_BODY, Panel, PanelNote } from "../ui/Panel";
import type { PanelProps } from "./panelProps";
import type { PositionsQueue } from "./seam";
import {
  coloursClubLabel,
  coloursTitle,
  noUncolouredWords,
  patternLabel,
  patternWords,
  primaryLabel,
  saveColoursWords,
  secondaryLabel,
  uncolouredHint,
  uncolouredTitle,
} from "./words";

// Each club's colours and shirt pattern, the admin's (spec/15, The admin; #838): the clubs with
// none wait in the queue beside the clubs to approve, and any club's can be set at any time.

type Club = PositionsQueue["clubs"][number];

const CLUB_ID = "colours-club";
const PATTERN_ID = "colours-pattern";
const PATTERNS: readonly Pattern[] = ["plain", "stripes"];

/** The clubs with no colours held, whose shirts and marks are white until he sets them. */
export function Uncoloured({ queue }: Pick<PanelProps, "queue">) {
  const uncoloured = queue.clubs.filter((club) => club.colours === null);
  return (
    <Panel title={uncolouredTitle}>
      <PanelNote>{uncolouredHint}</PanelNote>
      {uncoloured.length === 0 ? (
        <PanelNote edge="b">{noUncolouredWords}</PanelNote>
      ) : (
        <ul aria-label={uncolouredTitle} className="border-t border-panel-rule">
          {uncoloured.map((club) => (
            <li key={club.code} className="border-b border-panel-rule px-3 py-1 font-semibold">
              {club.name}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Any club's two colours and pattern, a club with none first. */
export function ClubColours({ queue, seam, change }: PanelProps) {
  const firstUncoloured = queue.clubs.find((club) => club.colours === null)?.code;
  const [clubCode, choose] = useChoiceAmong(
    queue.clubs.map((club) => club.code),
    firstUncoloured,
  );
  const club = queue.clubs.find((each) => each.code === clubCode);
  return (
    <Panel title={coloursTitle}>
      <div className={PANEL_BODY}>
        <span className="flex flex-col gap-1">
          <label htmlFor={CLUB_ID} className="font-semibold">
            {coloursClubLabel}
          </label>
          <select id={CLUB_ID} value={clubCode} onChange={(event) => choose(Number(event.target.value))} className="text-box">
            {queue.clubs.map((each) => (
              <option key={each.code} value={each.code}>
                {each.name}
              </option>
            ))}
          </select>
        </span>
        {/* Keyed on the club, so choosing another starts from its colours. */}
        {club !== undefined && <ColoursForm key={club.code} club={club} seam={seam} change={change} />}
      </div>
    </Panel>
  );
}

function ColoursForm({ club, seam, change }: { club: Club } & Pick<PanelProps, "seam" | "change">) {
  const [colours, setColours] = useState<Colours>(club.colours ?? UNSET_COLOURS);
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void change.run(() => seam.setClubColours(club.code, colours));
  }
  const fields = [
    { id: "colours-primary", label: primaryLabel, key: "primary" },
    { id: "colours-secondary", label: secondaryLabel, key: "secondary" },
  ] as const;
  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <span className="flex flex-wrap gap-4">
        {fields.map((field) => (
          <span key={field.id} className="flex flex-col gap-1">
            <label htmlFor={field.id} className="font-semibold">
              {field.label}
            </label>
            <input
              id={field.id}
              type="color"
              value={colours[field.key].toLowerCase()}
              onChange={(event) => setColours({ ...colours, [field.key]: event.target.value })}
              className="min-h-tap min-w-tap"
            />
          </span>
        ))}
        <span className="flex flex-col gap-1">
          <label htmlFor={PATTERN_ID} className="font-semibold">
            {patternLabel}
          </label>
          <select
            id={PATTERN_ID}
            value={colours.pattern}
            onChange={(event) => setColours({ ...colours, pattern: event.target.value as Pattern })}
            className="text-box"
          >
            {PATTERNS.map((pattern) => (
              <option key={pattern} value={pattern}>
                {patternWords[pattern]}
              </option>
            ))}
          </select>
        </span>
      </span>
      <button type="submit" disabled={change.busy} className="secondary-action self-start">
        {saveColoursWords}
      </button>
    </form>
  );
}
