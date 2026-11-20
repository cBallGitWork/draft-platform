// The seam for the Guide (spec/23): its sections and entries, and the admin's changes to them
// (S23.13). Convex fills it in live (liveGuide.ts); the preview and the tests hand the screens their
// own.

import type { Id } from "../../convex/_generated/dataModel";
import type { GuideSection } from "../../convex/guide/guide";
import type { FormationKind } from "../../convex/guide/formationEntries";
import type { Change } from "../shared/refusal";

export type { GuideSection };
export type GuideEntry = GuideSection["entries"][number];
/** A formation's or classic side's entry, by its list and name (S23.16). */
export type GuideFormation = { kind: FormationKind; name: string };

export type GuideSeam = {
  /** The whole Guide, sections and their entries in order, live (a hook): undefined while it loads. */
  useGuide(): readonly GuideSection[] | undefined;
  addSection(title: string): Change;
  /** Refused while the section holds entries (S23.14). */
  removeSection(sectionId: Id<"guideSections">): Change;
  /** Moves the section to `place`, 0 first. */
  moveSection(sectionId: Id<"guideSections">, place: number): Change;
  addEntry(sectionId: Id<"guideSections">, title: string, text: string): Change;
  editEntry(entryId: Id<"guideEntries">, title: string, text: string): Change;
  removeEntry(entryId: Id<"guideEntries">): Change;
  /** Moves the entry to `place` in the section's added entries, 0 first. */
  moveEntry(entryId: Id<"guideEntries">, sectionId: Id<"guideSections">, place: number): Change;
  /** Rewrites a formation entry's text, the formation window's description too (S23.7). */
  editFormationEntry(formation: GuideFormation, text: string): Change;
  /** Moves a formation entry to `place` among Tactics' formation entries, 0 first (S23.16). */
  moveFormationEntry(formation: GuideFormation, place: number): Change;
};
