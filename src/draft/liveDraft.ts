import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { DraftSeam } from "./seam";

/** The draft room seam filled in by Convex. */
export const liveDraft: DraftSeam = {
  useDraft: (leagueId, now) => useQuery(api.draft.draftStart.ofLeague, { leagueId, now }),
  useBoard: (leagueId, now) => useQuery(api.draft.draftBoard.ofLeague, { leagueId, now }),
  useInMenu: (leagueId) => useQuery(api.draft.draftBoard.inMenu, { leagueId }),
};
