// What the rules screens share (League settings, a part of a league's rules; Player scoring, the
// site's scoring set): the part as the server reads it, and the editor's draft of it, saved from
// the gameweek the server gives. A save carries the version the draft was made from, so one made
// over someone else's is refused (Craig, 22 Oct 2026; convex/rules/leagueRules.ts,
// convex/scoring/siteScoring.ts).

import { useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { sortedJson } from "../../convex/shared/sortedJson";
import { useChange } from "../shared/useChange";
import { holdsBlank, useBlankBox, type BoxRefusal } from "./blank";

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
 *  unless `blankRefusal` finds a box left without a number, which it tells `onRefused` (as the
 *  screen draws what that changes, the box is found inside `area`). That refusal is `boxRefusal`,
 *  said beside the box; any other, or one whose box isn't on screen, is `problem`, said in the bar. */
export function useRulesDraft<Part, Rev = Revision>(
  view: RulesView<Part, Rev>,
  save: SavePart<Part, Rev>,
  blankRefusal: (draft: Part) => string | null = () => null,
  onRefused: (draft: Part) => void = () => {},
) {
  const [edits, setEdits] = useState<{ part: Part; revision: Rev } | null>(null);
  const [savedFrom, setSavedFrom] = useState<number | null>(null);
  const [refusedBlank, setRefusedBlank] = useState(false);
  const saving = useChange();
  const blank = useBlankBox();
  const draft = edits?.part ?? view.part;
  const revision = edits?.revision ?? view.revision;
  const refusedBox = blank.box;
  const boxRefusal: BoxRefusal | null =
    refusedBlank && saving.problem !== null && refusedBox !== null ? { boxId: refusedBox.id, words: saving.problem, gone: () => blank.gone(refusedBox) } : null;

  /** What the bar says: a refusal from the server; or one for a blank box found nowhere on screen
   *  (another category opened, say), said afresh while the draft still holds a blank. */
  function barProblem(): string | null {
    if (!refusedBlank || saving.problem === null) return saving.problem;
    return boxRefusal === null ? blankRefusal(draft) : null;
  }

  function drop() {
    setEdits(null);
    saving.clear();
  }
  async function saveDraft() {
    let from: number | null = null;
    const made = await saving.run(async () => {
      const refused = blankRefusal(draft);
      setRefusedBlank(refused !== null);
      if (refused !== null) {
        onRefused(draft);
        blank.refused();
        return refused;
      }
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
    unchanged: !holdsBlank(draft) && sortedJson(draft) === sortedJson(view.part),
    overtaken: revision !== view.revision,
    savedFrom,
    busy: saving.busy,
    problem: barProblem(),
    boxRefusal,
    area: blank.area,
    edit(part: Part) {
      setEdits({ part, revision });
      setSavedFrom(null);
    },
    drop,
    saveDraft,
  };
}

export type RulesDraft<Part> = ReturnType<typeof useRulesDraft<Part>>;
