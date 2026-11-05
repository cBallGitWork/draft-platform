import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { liveScouting } from "../scouting/liveScouting";
import { refusalOf } from "../shared/refusal";
import type { DraftChanges, DraftSeam } from "./seam";
import { pickFailedWords } from "./words";

/** The draft room seam filled in by Convex. A refusal comes back as the server's own words
 *  (convex/draft/draftPicks.ts); any other failure is logged and said plainly. */
export const liveDraft: DraftSeam = {
  usePlayersList: liveScouting.usePlayersList,
  useDraft: (leagueId, now) => useQuery(api.draft.draftStart.ofLeague, { leagueId, now }),
  useBoard: (leagueId, now) => useQuery(api.draft.draftBoard.ofLeague, { leagueId, now }),
  useInMenu: (leagueId) => useQuery(api.draft.draftBoard.inMenu, { leagueId }),
  useGreyedOut: (leagueId) => useQuery(api.draft.draftPlayers.greyedOut, { leagueId }),
  useDraftChanges: () => {
    const makePick = useMutation(api.draft.draftPicks.makePick);
    return useMemo<DraftChanges>(
      () => ({ makePick: (leagueId, playerCode) => refusalOf(() => makePick({ leagueId, playerCode }), "Making a draft pick", pickFailedWords) }),
      [makePick],
    );
  },
};
