import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { useChange } from "../shared/useChange";
import { Loading, Problem } from "../ui/Panel";
import type { LeagueSettingsSeam } from "./seam";
import { SETTING_LINE, SettingRow } from "./SettingRow";
import { clearDraftStartWords, draftStartedFixedWords, draftStartHint, draftStartLabel, draftStartLoadingWords } from "./words";

const HINT_ID = "settings-draft-start-hint";
/** The date box's value with no date in it. */
const NO_DATE = "";

/** A moment as the date box holds it, in the viewer's own zone: "2026-08-15T19:00". */
function boxValueOf(at: number | null): string {
  if (at === null) return NO_DATE;
  const date = new Date(at);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** The moment the date box holds, read in the viewer's own zone; null for an empty box. */
const startOf = (value: string): number | null => (value === NO_DATE ? null : new Date(value).getTime());

/** The commissioner's edit of the draft's start date (spec/04, Starting it), saved with the rest of
 *  the settings (Craig, 11 Nov 2026, on #1476): until he types, the live date as it arrives. Once
 *  the draft has started there is nothing to change. `save` resolves with whether it was made;
 *  `saved` says one was, until the commissioner types or drops again (#1780). */
export function useDraftStartEdit(leagueId: Id<"leagues">, seam: LeagueSettingsSeam) {
  const view = seam.useDraftStart(leagueId);
  const [typed, setTyped] = useState<string | null>(null);
  // A date box part-way through being typed reports "" as an empty one does: that is no choice
  // yet, never a cleared date, so it keeps the live one until a whole date is typed.
  const [halfTyped, setHalfTyped] = useState(false);
  const [saved, setSaved] = useState(false);
  const saving = useChange();
  const startsAt = view?.startsAt ?? null;
  const chosen = typed === null || halfTyped ? startsAt : startOf(typed);
  return {
    view,
    value: typed ?? boxValueOf(startsAt),
    unchanged: view === undefined || view.started || chosen === startsAt,
    busy: saving.busy,
    problem: saving.problem,
    /** A date was just saved, and nothing typed or dropped since. */
    saved,
    /** `halfTyped`: the box holds a date not yet whole (its `validity.badInput`). */
    type(value: string, halfTyped = false) {
      setTyped(value);
      setHalfTyped(halfTyped);
      setSaved(false);
    },
    drop() {
      setTyped(null);
      setHalfTyped(false);
      setSaved(false);
      saving.clear();
    },
    async save(): Promise<boolean> {
      const made = await saving.run(() => seam.setDraftStart(leagueId, chosen));
      if (made) setTyped(null);
      setSaved(made);
      return made;
    },
    /** Lets a saved date go unsaid, once the settings' own save says how the bar's save went. */
    forgetSaved() {
      setSaved(false);
    },
  };
}

export type DraftStartEdit = ReturnType<typeof useDraftStartEdit>;

/** The "Starts" row: the date box and Clear while the draft waits; once it has started, words. */
export function DraftStartRow({ start }: { start: DraftStartEdit }) {
  return <SettingRow label={draftStartLabel}>{start.view === undefined ? <Loading>{draftStartLoadingWords}</Loading> : <DraftStart start={start} view={start.view} />}</SettingRow>;
}

function DraftStart({ start, view }: { start: DraftStartEdit; view: NonNullable<DraftStartEdit["view"]> }) {
  return (
    <>
      <div className={SETTING_LINE}>
        {view.started ? (
          <span>{draftStartedFixedWords}</span>
        ) : (
          <>
            <input
              type="datetime-local"
              aria-label={draftStartLabel}
              aria-describedby={HINT_ID}
              className="text-box"
              disabled={start.busy}
              value={start.value}
              onChange={(event) => start.type(event.target.value, event.target.validity.badInput)}
            />
            {start.value !== NO_DATE && (
              <button type="button" disabled={start.busy} onClick={() => start.type(NO_DATE)} className="secondary-action">
                {clearDraftStartWords}
              </button>
            )}
          </>
        )}
      </div>
      {!view.started && (
        <p id={HINT_ID} className="text-muted">
          {draftStartHint}
        </p>
      )}
      <Problem problem={start.problem} />
    </>
  );
}
