// The Guide in the preview (src/app/preview.ts): three sections of made-up entries, Tactics holding an entry of its own
// and the formation entries as the server lists them (S23.7); every change changes nothing.

import type { Id } from "../../convex/_generated/dataModel";
import { LISTED_FORMATIONS } from "../../convex/guide/formationEntries";
import { previewSays } from "../shared/preview";
import type { GuideEntry, GuideSeam, GuideSection } from "./seam";

/** A made-up entry's text: Claude drafts the real ones (S23.12). */
const SAMPLE = "A sample entry: the admin's words go here.\n\nA second paragraph.";

const section = (number: number, title: string, entries: GuideEntry[]): GuideSection => ({
  sectionId: `preview-guide-section-${number}` as Id<"guideSections">,
  title,
  entries,
});
const entry = (number: number, title: string, text: string): GuideEntry => ({
  entryId: `preview-guide-entry-${number}` as Id<"guideEntries">,
  title,
  text,
});

const guide: readonly GuideSection[] = [
  section(1, "Basics", [entry(1, "Gameweeks", SAMPLE), entry(2, "Deadlines", SAMPLE)]),
  section(2, "Tactics", [
    entry(3, "Formations", SAMPLE),
    ...LISTED_FORMATIONS.map(({ kind, name, text }) => ({ formation: { kind, name }, title: name, text })),
  ]),
  section(3, "Waivers", []),
];

const nothingChanged = previewSays("nothing changed");

export const previewGuide: GuideSeam = {
  useGuide: () => guide,
  addSection: nothingChanged,
  removeSection: nothingChanged,
  moveSection: nothingChanged,
  addEntry: nothingChanged,
  editEntry: nothingChanged,
  removeEntry: nothingChanged,
  moveEntry: nothingChanged,
  editFormationEntry: nothingChanged,
  moveFormationEntry: nothingChanged,
};
