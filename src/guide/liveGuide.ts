import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { refusalOf } from "../shared/refusal";
import { changeFailedWords } from "../shared/words";
import type { GuideSeam } from "./seam";

const useGuide: GuideSeam["useGuide"] = () => useQuery(api.guide.guide.list, {});

/** The Guide's seam filled in by Convex. A refusal comes back as the server's own words; any other
 *  failure is logged and said plainly. */
export function useLiveGuide(): GuideSeam {
  const addSection = useMutation(api.guide.guide.addSection);
  const removeSection = useMutation(api.guide.guide.removeSection);
  const moveSection = useMutation(api.guide.guide.moveSection);
  const addEntry = useMutation(api.guide.guide.addEntry);
  const editEntry = useMutation(api.guide.guide.editEntry);
  const removeEntry = useMutation(api.guide.guide.removeEntry);
  const moveEntry = useMutation(api.guide.guide.moveEntry);
  const editFormationEntry = useMutation(api.guide.guide.editFormationEntry);
  const moveFormationEntry = useMutation(api.guide.guide.moveFormationEntry);
  return useMemo(() => {
    const changing = (what: string, change: () => Promise<unknown>) => refusalOf(change, what, changeFailedWords);
    return {
      useGuide,
      addSection: (title) => changing("Adding a Guide section", () => addSection({ title })),
      removeSection: (sectionId) => changing("Removing a Guide section", () => removeSection({ sectionId })),
      moveSection: (sectionId, place) => changing("Moving a Guide section", () => moveSection({ sectionId, place })),
      addEntry: (sectionId, title, text) => changing("Adding a Guide entry", () => addEntry({ sectionId, title, text })),
      editEntry: (entryId, title, text) => changing("Editing a Guide entry", () => editEntry({ entryId, title, text })),
      removeEntry: (entryId) => changing("Removing a Guide entry", () => removeEntry({ entryId })),
      moveEntry: (entryId, sectionId, place) => changing("Moving a Guide entry", () => moveEntry({ entryId, sectionId, place })),
      editFormationEntry: (formation, text) => changing("Editing a formation's Guide entry", () => editFormationEntry({ formation, text })),
      moveFormationEntry: (formation, place) => changing("Moving a formation's Guide entry", () => moveFormationEntry({ formation, place })),
    };
  }, [addSection, removeSection, moveSection, addEntry, editEntry, removeEntry, moveEntry, editFormationEntry, moveFormationEntry]);
}
