import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { answerOf } from "../refusal";
import { useMinute } from "../useMinute";
import type { LeagueSettingsSeam } from "./seam";
import { saveFailedWords } from "./words";

/** Asked again each minute, so the gameweek a change takes effect from moves on at a deadline. */
const useSettings: LeagueSettingsSeam["useSettings"] = (leagueId) => useQuery(api.rules.leagueSettings.settings, { leagueId, now: useMinute() });

/** League settings' seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/rules/); any other failure is logged and said plainly. */
export function useLiveLeagueSettings(): LeagueSettingsSeam {
  const changeSettings = useMutation(api.rules.leagueSettings.changeSettings);
  return useMemo(
    () => ({
      useSettings,
      save: (leagueId, settings, revision) => answerOf(() => changeSettings({ leagueId, settings, revision }), "Saving the league settings", saveFailedWords),
    }),
    [changeSettings],
  );
}
