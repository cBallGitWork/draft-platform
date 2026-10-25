// What the screens that edit part of a league's rules share (Player scoring, League settings): the
// part as the server reads it, and the commissioner's draft of it, saved from the next gameweek.
// A save carries the rules row the draft was made from, so one made over someone else's is
// refused (Craig, 22 Oct 2026; convex/rules/leagueRules.ts).

import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { sortedJson } from "../../convex/shared/sortedJson";
import { useChange } from "../useChange";

/** The rules row a part was read from. */
export type Revision = Id<"leagueRules">;

/** A part of the league's latest rules, the row it is from, and the gameweek a change saved now
 *  would take effect from (`editorView` on the server). */
export type RulesView<Part> = { part: Part; revision: Revision; changesFrom: number };

/** Saves a part: resolves with the gameweek it takes effect from, or the words saying why not. */
type SavePart<Part> = (part: Part, revision: Revision) => Promise<number | string>;

/** The commissioner's draft of `view`'s part. Until they edit, it is the latest as it arrives;
 *  once they have, it keeps their edits and the row they were made from, and is `overtaken` once
 *  someone else saves. `drop` lets the edits go for the latest. `saveDraft` saves it with `save`,
 *  unless `refusal` finds a reason not to ask the server. */
export function useRulesDraft<Part>(view: RulesView<Part>, save: SavePart<Part>, refusal: (draft: Part) => string | null = () => null) {
  const [edits, setEdits] = useState<{ part: Part; revision: Revision } | null>(null);
  const [savedFrom, setSavedFrom] = useState<number | null>(null);
  const saving = useChange();
  const draft = edits?.part ?? view.part;
  const revision = edits?.revision ?? view.revision;

  function drop() {
    setEdits(null);
    saving.clear();
  }
  async function saveDraft() {
    let from: number | null = null;
    const made = await saving.run(async () => {
      const refused = refusal(draft);
      if (refused !== null) return refused;
      const answer = await save(draft, revision);
      if (typeof answer === "string") return answer;
      from = answer;
      return null;
    });
    if (!made) return;
    // The live part has this save in it by now: Convex answers a mutation after its queries.
    setEdits(null);
    setSavedFrom(from);
  }
  return {
    draft,
    changesFrom: view.changesFrom,
    unchanged: sortedJson(draft) === sortedJson(view.part),
    overtaken: revision !== view.revision,
    savedFrom,
    busy: saving.busy,
    problem: saving.problem,
    edit(part: Part) {
      setEdits({ part, revision });
      setSavedFrom(null);
    },
    drop,
    saveDraft,
  };
}

export type RulesDraft<Part> = ReturnType<typeof useRulesDraft<Part>>;
