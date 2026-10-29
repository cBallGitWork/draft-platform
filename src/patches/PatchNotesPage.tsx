import { Loading, PageSection, PanelNote } from "../ui/Panel";
import type { PatchesSeam, VersionNotes } from "./seam";
import { fromWords, KIND_WORDS, loadingWords, noVersionsWords, notesHint, nothingScoresDifferentlyWords, PATCH_NOTES_TITLE } from "./words";

/** The patch notes (spec/14, Changes and corrections): every version of the site's scoring, newest
 *  first, each with what it changed from the one before, as the server works it out. */
export function PatchNotesPage({ seam }: { seam: PatchesSeam }) {
  const notes = seam.useNotes();
  return (
    <PageSection title={PATCH_NOTES_TITLE} className="max-w-3xl bg-panel">
      <PanelNote>{notesHint}</PanelNote>
      {notes === undefined && <Loading className="px-3 pb-2">{loadingWords}</Loading>}
      {notes?.length === 0 && <PanelNote>{noVersionsWords}</PanelNote>}
      {notes !== undefined && notes.length > 0 && (
        <ol>
          {notes.map((version) => (
            <Version key={version.name} version={version} />
          ))}
        </ol>
      )}
    </PageSection>
  );
}

/** One version: its name, whether a patch or a fix, when it is in force from, and its changes. */
function Version({ version: { name, kind, takesEffectAt, changes } }: { version: VersionNotes }) {
  const headingId = `version-${name}`;
  return (
    <li aria-labelledby={headingId} className="border-t border-panel-rule">
      <h2 id={headingId} className="flex flex-wrap items-baseline gap-x-3 bg-plate px-3 py-1 shadow-bevel-plate">
        <span className="text-lead font-bold">{name}</span>
        <span className="font-semibold">{KIND_WORDS[kind]}</span>
        <span className="text-soft">{fromWords(takesEffectAt)}</span>
      </h2>
      <ul className="px-3 py-2">
        {changes.length === 0 && <li className="text-muted">{nothingScoresDifferentlyWords}</li>}
        {changes.map((change) => (
          <li key={change} className="py-0.5 wrap-anywhere">
            {change}
          </li>
        ))}
      </ul>
    </li>
  );
}
