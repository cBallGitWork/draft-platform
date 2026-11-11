import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { answerOf, refusalOf } from "../shared/refusal";
import { useMinute } from "../shared/useMinute";
import type { LeagueSettingsSeam } from "./seam";
import { liveClaims } from "../myTeam/claims/liveClaims";
import { draftStartFailedWords, saveFailedWords, scoringStartFailedWords, teamOrderFailedWords } from "./words";

/** Asked again each minute, so the gameweek a change takes effect from moves on at a deadline. */
const useSettings: LeagueSettingsSeam["useSettings"] = (leagueId) => useQuery(api.rules.leagueSettings.settings, { leagueId, now: useMinute() });

const useTeamOrder: LeagueSettingsSeam["useTeamOrder"] = (leagueId) => useQuery(api.draft.draftOrder.teamOrder, { leagueId });

const useScoringStart: LeagueSettingsSeam["useScoringStart"] = (leagueId) => useQuery(api.gameweeks.scoringStart.ofLeague, { leagueId });

/** The draft's date while it waits; one under way or over has started. The query's `now` moves
 *  nothing (draftStart.ts), so it is the screen's minute, as the draft room's is. */
const useDraftStart: LeagueSettingsSeam["useDraftStart"] = (leagueId) => {
  const draft = useQuery(api.draft.draftStart.ofLeague, { leagueId, now: useMinute() });
  if (draft === undefined) return undefined;
  return draft.status === "waiting" ? { startsAt: draft.startsAt, started: false } : { startsAt: null, started: true };
};

/** League settings' seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/rules/, convex/draft/); any other failure is logged and said plainly. */
export function useLiveLeagueSettings(): LeagueSettingsSeam {
  const changeSettings = useMutation(api.rules.leagueSettings.changeSettings);
  const setTeamOrder = useMutation(api.draft.draftOrder.setTeamOrder);
  const drawTeamOrder = useMutation(api.draft.draftOrder.drawTeamOrder);
  const setScoringStart = useMutation(api.gameweeks.scoringStart.setScoringStart);
  const setStart = useMutation(api.draft.draftStart.setStart);
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
      useDraftStart,
      setDraftStart: (leagueId, startsAt) => refusalOf(() => setStart({ leagueId, startsAt }), "Setting the draft's start", draftStartFailedWords),
      useWaivers: liveClaims.useWaivers,
    }),
    [changeSettings, setTeamOrder, drawTeamOrder, setScoringStart, setStart],
  );
}
