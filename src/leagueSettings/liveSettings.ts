import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { answerOf, refusalOf } from "../shared/refusal";
import { useMinute } from "../shared/useMinute";
import type { LeagueSettingsSeam } from "./seam";
import { liveClaims } from "../myTeam/claims/liveClaims";
import { saveFailedWords, scoringStartFailedWords, teamOrderFailedWords } from "./words";

/** Asked again each minute, so the gameweek a change takes effect from moves on at a deadline. */
const useSettings: LeagueSettingsSeam["useSettings"] = (leagueId) => useQuery(api.rules.leagueSettings.settings, { leagueId, now: useMinute() });

const useTeamOrder: LeagueSettingsSeam["useTeamOrder"] = (leagueId) => useQuery(api.draft.draftOrder.teamOrder, { leagueId });

const useScoringStart: LeagueSettingsSeam["useScoringStart"] = (leagueId) => useQuery(api.gameweeks.scoringStart.ofLeague, { leagueId });

/** League settings' seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/rules/, convex/draft/); any other failure is logged and said plainly. */
export function useLiveLeagueSettings(): LeagueSettingsSeam {
  const changeSettings = useMutation(api.rules.leagueSettings.changeSettings);
  const setTeamOrder = useMutation(api.draft.draftOrder.setTeamOrder);
  const drawTeamOrder = useMutation(api.draft.draftOrder.drawTeamOrder);
  const setScoringStart = useMutation(api.gameweeks.scoringStart.setScoringStart);
  return useMemo(
    () => ({
      useSettings,
      save: (leagueId, settings, revision) => answerOf(() => changeSettings({ leagueId, settings, revision }), "Saving the league settings", saveFailedWords),
      useTeamOrder,
      saveTeamOrder: (leagueId, teamIds) => refusalOf(() => setTeamOrder({ leagueId, teamIds }), "Saving the draft order", teamOrderFailedWords),
      drawTeamOrder: (leagueId) => refusalOf(() => drawTeamOrder({ leagueId }), "Drawing the draft order", teamOrderFailedWords),
      useScoringStart,
      setScoringStart: (leagueId, gameweek) =>
        refusalOf(() => setScoringStart({ leagueId, gameweek }), "Setting the scoring start", scoringStartFailedWords),
      useWaivers: liveClaims.useWaivers,
    }),
    [changeSettings, setTeamOrder, drawTeamOrder, setScoringStart],
  );
}
