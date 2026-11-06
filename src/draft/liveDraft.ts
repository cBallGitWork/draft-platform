import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { liveScouting } from "../scouting/liveScouting";
import { refusalOf } from "../shared/refusal";
import { changeFailedWords as commissionerFailedWords } from "../shared/words";
import type { CommissionerChanges, DraftChanges, DraftSeam } from "./seam";
import { pickFailedWords } from "./words";

/** The draft room seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/draft/); any other failure is logged and said plainly. */
export const liveDraft: DraftSeam = {
  usePlayersList: liveScouting.usePlayersList,
  useDraft: (leagueId, now) => useQuery(api.draft.draftStart.ofLeague, { leagueId, now }),
  useBoard: (leagueId, now) => useQuery(api.draft.draftBoard.ofLeague, { leagueId, now }),
  useInMenu: (leagueId) => useQuery(api.draft.draftBoard.inMenu, { leagueId }),
  useGreyedOut: (leagueId) => useQuery(api.draft.draftPlayers.greyedOut, { leagueId }),
  useFigures: (leagueId, now) => useQuery(api.draft.draftPlayers.figures, { leagueId, now }),
  useLists: (leagueId) => useQuery(api.draft.draftLists.mine, { leagueId }),
  useDraftChanges: () => {
    const makePick = useMutation(api.draft.draftPicks.makePick);
    return useMemo<DraftChanges>(
      () => ({ makePick: (leagueId, playerCode) => refusalOf(() => makePick({ leagueId, playerCode }), "Making a draft pick", pickFailedWords) }),
      [makePick],
    );
  },
  useCommissioner: (leagueId, now) => useQuery(api.draft.draftCommissioner.panel, { leagueId, now }),
  useCommissionerChanges: function useCommissionerChanges() {
    const start = useMutation(api.draft.draftStart.start);
    const pause = useMutation(api.draft.draftPause.pause);
    const resume = useMutation(api.draft.draftPause.resume);
    const undo = useMutation(api.draft.draftCommissioner.undoPick);
    const setPickTime = useMutation(api.draft.draftCommissioner.setPickTime);
    const mark = useMutation(api.draft.draftCommissioner.markForCommissioner);
    return useMemo<CommissionerChanges>(
      () => ({
        start: (leagueId) => refusalOf(() => start({ leagueId }), "Starting the draft", commissionerFailedWords),
        pause: (leagueId) => refusalOf(() => pause({ leagueId }), "Pausing the draft", commissionerFailedWords),
        resume: (leagueId) => refusalOf(() => resume({ leagueId }), "Resuming the draft", commissionerFailedWords),
        undo: (leagueId) => refusalOf(() => undo({ leagueId }), "Undoing the last pick", commissionerFailedWords),
        setPickTime: (leagueId, pickSeconds) => refusalOf(() => setPickTime({ leagueId, pickSeconds }), "Setting the pick time", commissionerFailedWords),
        markForCommissioner: (leagueId, teamId, marked) => refusalOf(() => mark({ leagueId, teamId, marked }), "Marking a team to pick for", commissionerFailedWords),
      }),
      [start, pause, resume, undo, setPickTime, mark],
    );
  },
};
