import { useAction, useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { answerOf, refusalOf } from "../shared/refusal";
import { useMinute } from "../shared/useMinute";
import type { ScoringSeam } from "./seam";
import { announceFailedWords, draftFailedWords, labFailedWords, saveFailedWords, withdrawFailedWords } from "./words";

/** Asked again each minute, so the gameweek a change takes effect from moves on at a kickoff. */
const useScoring: ScoringSeam["useScoring"] = () => useQuery(api.scoring.siteScoring.view, { now: useMinute() });

/** Player scoring's seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/scoring/siteScoring.ts); any other failure is logged and said plainly. */
export function useLiveScoring(): ScoringSeam {
  const fix = useMutation(api.scoring.siteScoring.fix);
  const saveDraft = useMutation(api.scoring.siteScoring.saveDraft);
  const announce = useMutation(api.scoring.siteScoring.announce);
  const withdraw = useMutation(api.scoring.siteScoring.withdraw);
  const runLab = useAction(api.balanceLab.balanceLabRun.run);
  return useMemo(
    () => ({
      useScoring,
      save: (scoring, revision) => answerOf(() => fix({ scoring, revision }), "Saving the scoring", saveFailedWords),
      saveDraft: (scoring, revision, draftSavedAt) =>
        answerOf(() => saveDraft({ scoring, revision, draftSavedAt }), "Saving the draft patch", draftFailedWords),
      announce: (draftSavedAt, takesEffectAt) => answerOf(() => announce({ draftSavedAt, takesEffectAt }), "Announcing the patch", announceFailedWords),
      withdraw: (versionId) => refusalOf(() => withdraw({ versionId }), "Withdrawing the patch", withdrawFailedWords),
      runLab: (draftSavedAt) => answerOf(() => runLab({ draftSavedAt }), "Running the rule balance lab", labFailedWords),
    }),
    [fix, saveDraft, announce, withdraw, runLab],
  );
}
