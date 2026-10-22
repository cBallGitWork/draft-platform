import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { answerOf } from "../refusal";
import { useMinute } from "../useMinute";
import type { ScoringSeam } from "./seam";
import { saveFailedWords } from "./words";

/** Asked again each minute, so the gameweek a change takes effect from moves on at a deadline. */
const useScoring: ScoringSeam["useScoring"] = (leagueId) => useQuery(api.rules.leagueRules.scoring, { leagueId, now: useMinute() });

/** The rules editor's seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/rules/leagueRules.ts); any other failure is logged and said plainly. */
export function useLiveScoring(): ScoringSeam {
  const changeScoring = useMutation(api.rules.leagueRules.changeScoring);
  return useMemo(
    () => ({
      useScoring,
      save: (leagueId, scoring) => answerOf(() => changeScoring({ leagueId, scoring }), "Saving the scoring", saveFailedWords),
    }),
    [changeScoring],
  );
}
