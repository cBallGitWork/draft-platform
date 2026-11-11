import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { useChange } from "../shared/useChange";
import { Loading, Problem } from "../ui/Panel";
import type { LeagueSettingsSeam } from "./seam";
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
 *  the draft has started there is nothing to change. `save` resolves with whether it was made. */
export function useDraftStartEdit(leagueId: Id<"leagues">, seam: LeagueSettingsSeam) {
  const view = seam.useDraftStart(leagueId);
  const [typed, setTyped] = useState<string | null>(null);
  const saving = useChange();
  const startsAt = view?.startsAt ?? null;
  const chosen = typed === null ? startsAt : startOf(typed);
  return {
    view,
    value: typed ?? boxValueOf(startsAt),
    unchanged: view === undefined || view.started || chosen === startsAt,
    busy: saving.busy,
    problem: saving.problem,
    type: setTyped,
    drop() {
      setTyped(null);
      saving.clear();
    },
    async save(): Promise<boolean> {
      const made = await saving.run(() => seam.setDraftStart(leagueId, chosen));
      if (made) setTyped(null);
      return made;
    },
  };
}

export type DraftStartEdit = ReturnType<typeof useDraftStartEdit>;

/** "Starts": the date box and Clear while the draft waits; once it has started, words. */
export function DraftStartRow({ start }: { start: DraftStartEdit }) {
  if (start.view === undefined) return <Loading>{draftStartLoadingWords}</Loading>;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span aria-hidden className="text-soft">
          {draftStartLabel}
        </span>
        {start.view.started ? (
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
              onChange={(event) => start.type(event.target.value)}
            />
            {start.value !== NO_DATE && (
              <button type="button" disabled={start.busy} onClick={() => start.type(NO_DATE)} className="secondary-action">
                {clearDraftStartWords}
              </button>
            )}
          </>
        )}
      </div>
      {!start.view.started && (
        <p id={HINT_ID} className="text-muted">
          {draftStartHint}
        </p>
      )}
      <Problem problem={start.problem} />
    </div>
  );
}
