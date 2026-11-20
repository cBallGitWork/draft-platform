import { useId, useState, type FormEvent } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { GUIDE_TEXT_MAX, GUIDE_TITLE_MAX } from "../../convex/guide/guideLimits";
import type { GuideEntry, GuideSeam, GuideSection } from "../guide/seam";
import { Confirm } from "../ui/Confirm";
import { Loading, PAGE_STACK, PANEL_BODY, Panel, PanelNote } from "../ui/Panel";
import type { Change } from "../shared/refusal";
import { useChange, type Changing } from "../shared/useChange";
import { AdminHeader } from "./AdminHeader";
import { LabelledField } from "./fields";
import { guideLoadingWords, guideTitle, guideWords, noSectionsWords } from "./words";

/** The text box's height: a few paragraphs in view (S23.9). */
const TEXT_ROWS = 12;

/** What the right-hand panel shows: an entry, by its key, or a new one for a section. */
type Picked = { key: string } | { addingTo: Id<"guideSections"> };

/** An entry's key: the id of one the admin added, a formation's list and name (S23.16). */
const keyOf = (entry: GuideEntry) => ("entryId" in entry ? entry.entryId : `${entry.formation.kind}:${entry.formation.name}`);

/** The dashboard's Guide tab (spec/23 S23.13; the admin's data screens' organisation, as the
 *  approved Availability tab's): the sections and their entries in order down the left, each moved
 *  up or down, and the picked entry's panel on the right, to edit or remove it. A formation entry
 *  is edited and moved only (S23.16); a section goes only once it is empty (S23.14). A change shows
 *  to managers at once (S23.15). */
export function GuideTab({ seam }: { seam: GuideSeam }) {
  const guide = seam.useGuide();
  const change = useChange();
  const [picked, pick] = useState<Picked | null>(null);
  const shown = guide === undefined ? null : shownOf(guide, picked);
  return (
    <div className={PAGE_STACK}>
      <AdminHeader problem={change.problem} />
      {guide === undefined ? (
        <Loading>{guideLoadingWords}</Loading>
      ) : (
        <div className="grid items-start gap-2 lg:grid-cols-3">
          <Panel title={guideTitle} className="lg:col-span-2">
            {guide.length === 0 && <PanelNote>{noSectionsWords}</PanelNote>}
            <ul aria-label={guideTitle}>
              {guide.map((section, place) => (
                <Section
                  key={section.sectionId}
                  section={section}
                  place={place}
                  last={guide.length - 1}
                  shownKey={shown?.entry ? keyOf(shown.entry) : null}
                  pick={pick}
                  seam={seam}
                  change={change}
                />
              ))}
            </ul>
            <AddSection seam={seam} change={change} />
          </Panel>
          {shown?.entry && <EntryPanel key={keyOf(shown.entry)} section={shown.section} entry={shown.entry} seam={seam} change={change} />}
          {shown && shown.entry === null && (
            <NewEntryPanel key={shown.section.sectionId} section={shown.section} seam={seam} change={change} done={() => pick(null)} />
          )}
        </div>
      )}
    </div>
  );
}

/** What the right-hand panel shows: an entry of a section, or a new one for it (null). */
type Shown = { section: GuideSection; entry: GuideEntry | null };

/** What the right-hand panel shows: the picked entry, or the section a new one is for, while it is
 *  still there, else the first entry. */
function shownOf(guide: readonly GuideSection[], picked: Picked | null): Shown | null {
  if (picked !== null && "addingTo" in picked) {
    const section = guide.find((each) => each.sectionId === picked.addingTo);
    if (section) return { section, entry: null };
  }
  const all = guide.flatMap((section) => section.entries.map((entry) => ({ section, entry })));
  return all.find(({ entry }) => picked !== null && "key" in picked && keyOf(entry) === picked.key) ?? all[0] ?? null;
}

/** Up and Down: the secondary action, desk-sized, greyed where a row can't move that way, as League
 *  settings' (src/leagueSettings/FixturesPanel.tsx). */
const MOVE_ACTION = "secondary-action lg:min-h-0 lg:py-1 disabled:border-muted disabled:text-muted";

/** Up and Down for one row, moving it to the place above or below in its own list. */
function MoveButtons({ title, place, last, change, move }: { title: string; place: number; last: number; change: Changing; move: (place: number) => Change }) {
  return (
    <span className="flex gap-1">
      <button type="button" aria-label={guideWords.upLabel(title)} disabled={change.busy || place === 0} onClick={() => void change.run(() => move(place - 1))} className={MOVE_ACTION}>
        {guideWords.up}
      </button>
      <button type="button" aria-label={guideWords.downLabel(title)} disabled={change.busy || place === last} onClick={() => void change.run(() => move(place + 1))} className={MOVE_ACTION}>
        {guideWords.down}
      </button>
    </span>
  );
}

/** One section: its title, moved or removed once empty, then its entries, each picked or moved
 *  among its own kind: the added entries, then the formation entries (S23.16). */
function Section({
  section,
  place,
  last,
  shownKey,
  pick,
  seam,
  change,
}: {
  section: GuideSection;
  place: number;
  last: number;
  shownKey: string | null;
  pick: (picked: Picked) => void;
  seam: GuideSeam;
  change: Changing;
}) {
  const { sectionId, title, entries } = section;
  const added = entries.filter((entry) => "entryId" in entry);
  const formations = entries.filter((entry) => "formation" in entry);
  return (
    <li className="border-t border-panel-rule">
      <span className="flex flex-wrap items-center gap-2 bg-name-plate px-3 py-1">
        <h3 className="font-semibold">{title}</h3>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {entries.length === 0 ? (
            <button type="button" aria-label={guideWords.removeSectionLabel(title)} disabled={change.busy} onClick={() => void change.run(() => seam.removeSection(sectionId))} className="secondary-action">
              {guideWords.remove}
            </button>
          ) : (
            // A formation entry is never removed (S23.16), so its section never empties: no hint.
            formations.length === 0 && <span className="text-soft">{guideWords.notEmpty}</span>
          )}
          <MoveButtons title={title} place={place} last={last} change={change} move={(to) => seam.moveSection(sectionId, to)} />
        </span>
      </span>
      <ul aria-label={title}>
        {entries.map((entry) => {
          const own = "entryId" in entry ? added : formations;
          const move = (to: number) => ("entryId" in entry ? seam.moveEntry(entry.entryId, sectionId, to) : seam.moveFormationEntry(entry.formation, to));
          const current = keyOf(entry) === shownKey;
          return (
            <li key={keyOf(entry)} className={`flex items-center gap-2 border-t border-panel-rule px-3${current ? " bg-name-plate shadow-current-edge" : ""}`}>
              <button type="button" aria-pressed={current} onClick={() => pick({ key: keyOf(entry) })} className="min-h-tap text-left lg:min-h-row">
                {entry.title}
              </button>
              <span className="ml-auto">
                <MoveButtons title={entry.title} place={own.findIndex((each) => keyOf(each) === keyOf(entry))} last={own.length - 1} change={change} move={move} />
              </span>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-panel-rule px-3 py-1">
        <button type="button" aria-label={guideWords.newEntryLabel(title)} onClick={() => pick({ addingTo: sectionId })} className="secondary-action">
          {guideWords.newEntry}
        </button>
      </p>
    </li>
  );
}

/** A title and a text, typed: the boxes the edit and the new entry share. A formation entry's title
 *  is its name, so it has no title box (S23.16). */
function EntryFields({ title, text, onTitle, onText }: { title: string | null; text: string; onTitle: (title: string) => void; onText: (text: string) => void }) {
  const titleId = useId();
  const textId = useId();
  return (
    <>
      {title !== null && (
        <LabelledField id={titleId} label={guideWords.titleLabel}>
          <input id={titleId} required maxLength={GUIDE_TITLE_MAX} value={title} onChange={(event) => onTitle(event.target.value)} className="text-box" />
        </LabelledField>
      )}
      <LabelledField id={textId} label={guideWords.textLabel}>
        <textarea id={textId} required maxLength={GUIDE_TEXT_MAX} rows={TEXT_ROWS} value={text} onChange={(event) => onText(event.target.value)} className="text-box py-1" />
      </LabelledField>
    </>
  );
}

/** The picked entry's panel: its title and text saved together, and Remove after a yes, for an
 *  entry the admin added only (S23.16). */
function EntryPanel({ section, entry, seam, change }: { section: GuideSection; entry: GuideEntry; seam: GuideSeam; change: Changing }) {
  const [title, setTitle] = useState(entry.title);
  const [text, setText] = useState(entry.text);
  const [confirming, setConfirming] = useState(false);
  const added = "entryId" in entry ? entry.entryId : null;
  function save(event: FormEvent) {
    event.preventDefault();
    void change.run(() => ("entryId" in entry ? seam.editEntry(entry.entryId, title, text) : seam.editFormationEntry(entry.formation, text)));
  }
  return (
    <Panel title={entry.title} aside={<span className="text-soft">{section.title}</span>}>
      <form onSubmit={save} className={PANEL_BODY}>
        <EntryFields title={added === null ? null : title} text={text} onTitle={setTitle} onText={setText} />
        <span className="flex flex-wrap gap-2">
          <button type="submit" disabled={change.busy} className="action">
            {guideWords.save}
          </button>
          {added !== null && !confirming && (
            <button type="button" onClick={() => setConfirming(true)} className="secondary-action">
              {guideWords.remove}
            </button>
          )}
        </span>
        {added !== null && confirming && (
          <Confirm
            question={guideWords.confirm(entry.title)}
            yes={guideWords.yes}
            no={guideWords.no}
            busy={change.busy}
            onYes={() => void change.run(() => seam.removeEntry(added))}
            onNo={() => setConfirming(false)}
          />
        )}
      </form>
    </Panel>
  );
}

/** A new entry for a section, added at its foot. */
function NewEntryPanel({ section, seam, change, done }: { section: GuideSection; seam: GuideSeam; change: Changing; done: () => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  async function add(event: FormEvent) {
    event.preventDefault();
    if (await change.run(() => seam.addEntry(section.sectionId, title, text))) done();
  }
  return (
    <Panel title={guideWords.newEntryLabel(section.title)}>
      <form onSubmit={(event) => void add(event)} className={PANEL_BODY}>
        <EntryFields title={title} text={text} onTitle={setTitle} onText={setText} />
        <button type="submit" disabled={change.busy} className="action self-start">
          {guideWords.add}
        </button>
      </form>
    </Panel>
  );
}

/** A new section, added at the foot of the list. */
function AddSection({ seam, change }: { seam: GuideSeam; change: Changing }) {
  const [title, setTitle] = useState("");
  const id = useId();
  async function add(event: FormEvent) {
    event.preventDefault();
    if (await change.run(() => seam.addSection(title))) setTitle("");
  }
  return (
    <form onSubmit={(event) => void add(event)} className="flex flex-wrap items-end gap-2 border-t border-panel-rule p-3">
      <LabelledField id={id} label={guideWords.newSectionLabel}>
        <input id={id} required maxLength={GUIDE_TITLE_MAX} value={title} onChange={(event) => setTitle(event.target.value)} className="text-box" />
      </LabelledField>
      <button type="submit" disabled={change.busy} className="secondary-action">
        {guideWords.addSection}
      </button>
    </form>
  );
}
