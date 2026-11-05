import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { refusalOf } from "../shared/refusal";
import { changeFailedWords as commissionerFailedWords } from "../shared/words";
import type { CommissionerChanges, DraftSeam } from "./seam";

/** The draft room seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/draft/); any other failure is logged and said plainly. */
export const liveDraft: DraftSeam = {
  useDraft: (leagueId, now) => useQuery(api.draft.draftStart.ofLeague, { leagueId, now }),
  useBoard: (leagueId, now) => useQuery(api.draft.draftBoard.ofLeague, { leagueId, now }),
  useInMenu: (leagueId) => useQuery(api.draft.draftBoard.inMenu, { leagueId }),
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
