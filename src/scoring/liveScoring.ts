import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { answerOf } from "../shared/refusal";
import { useMinute } from "../shared/useMinute";
import type { ScoringSeam } from "./seam";
import { saveFailedWords } from "./words";

/** Asked again each minute, so the gameweek a change takes effect from moves on at a kickoff. */
const useScoring: ScoringSeam["useScoring"] = () => useQuery(api.scoring.siteScoring.view, { now: useMinute() });

/** Player scoring's seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/scoring/siteScoring.ts); any other failure is logged and said plainly. */
export function useLiveScoring(): ScoringSeam {
  const fix = useMutation(api.scoring.siteScoring.fix);
  return useMemo(
    () => ({
      useScoring,
      save: (scoring, revision) => answerOf(() => fix({ scoring, revision }), "Saving the scoring", saveFailedWords),
    }),
    [fix],
  );
}
