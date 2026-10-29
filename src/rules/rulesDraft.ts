// What the rules screens share (League settings, a part of a league's rules; Player scoring, the
// site's scoring set): the part as the server reads it, and the editor's draft of it, saved from
// the gameweek the server gives. A save carries the version the draft was made from, so one made
// over someone else's is refused (Craig, 22 Oct 2026; convex/rules/leagueRules.ts,
// convex/scoring/siteScoring.ts).

import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { sortedJson } from "../../convex/shared/sortedJson";
import { useChange } from "../useChange";
import { holdsBlank } from "./blank";

/** The rules row a part was read from. */
export type Revision = Id<"leagueRules">;

/** A part of the league's latest rules, the row it is from, and the gameweek a change saved now
 *  would take effect from (`editorView` on the server); or the same of the site's scoring, its
 *  revision the site's (`Rev`). */
export type RulesView<Part, Rev = Revision> = { part: Part; revision: Rev; changesFrom: number };

/** Saves a part: resolves with the gameweek it takes effect from, or the words saying why not. */
type SavePart<Part, Rev> = (part: Part, revision: Rev) => Promise<number | string>;

/** The commissioner's draft of `view`'s part. Until they edit, it is the latest as it arrives;
 *  once they have, it keeps their edits and the row they were made from, and is `overtaken` once
 *  someone else saves. `drop` lets the edits go for the latest. `saveDraft` saves it with `save`,
 *  unless `refusal` finds a reason not to ask the server. */
export function useRulesDraft<Part, Rev = Revision>(view: RulesView<Part, Rev>, save: SavePart<Part, Rev>, refusal: (draft: Part) => string | null = () => null) {
  const [edits, setEdits] = useState<{ part: Part; revision: Rev } | null>(null);
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
    // A blank box is a change even where the saved part holds null: JSON writes NaN as null.
    unchanged: !holdsBlank(draft) && sortedJson(draft) === sortedJson(view.part),
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
