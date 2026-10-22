import type { ReactNode } from "react";
import { Notice, PanelNote, Problem } from "../frame/Panel";
import type { RulesDraft } from "./rulesDraft";
import { appliesFromWords, discardWords, gameweekWords, loadLatestWords, overtakenWords, saveWords, unchangedWords } from "./words";

/** The bar under a rules screen: the gameweek a change applies from, any of the screen's own
 *  controls (`children`), Discard and Save, then what came of the last save. Once someone else has
 *  saved the rules over the draft, it says its save will be refused, unless a refusal already says
 *  so, and offers the latest in place of Discard. `savedWords` says a save was made, from when. */
export function SaveBar<Part>({ draft, savedWords, children }: { draft: RulesDraft<Part>; savedWords: (gameweek: number) => string; children?: ReactNode }) {
  return (
    <div className="bg-panel">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
        <span>
          <span className="text-soft">{appliesFromWords}</span> <span className="font-semibold text-derived">{gameweekWords(draft.changesFrom)}</span>
        </span>
        {children}
        <span className="flex grow flex-wrap justify-end gap-2">
          {!draft.unchanged && !draft.overtaken && (
            <button type="button" onClick={draft.drop} className="secondary-action">
              {discardWords}
            </button>
          )}
          <button type="button" disabled={draft.unchanged || draft.busy} onClick={() => void draft.saveDraft()} className="action">
            {saveWords}
          </button>
        </span>
      </div>
      {draft.unchanged && draft.savedFrom === null && <PanelNote edge="b">{unchangedWords}</PanelNote>}
      {draft.savedFrom !== null && (
        <p role="status" className="px-3 pb-2">
          {savedWords(draft.savedFrom)}
        </p>
      )}
      <Problem problem={draft.problem} />
      {draft.overtaken && (
        <>
          {draft.problem === null && <Notice>{overtakenWords}</Notice>}
          <p className="px-3 py-2">
            <button type="button" onClick={draft.drop} className="secondary-action">
              {loadLatestWords}
            </button>
          </p>
        </>
      )}
    </div>
  );
}
