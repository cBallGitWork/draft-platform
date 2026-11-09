import { useMutation, useQuery } from "convex/react";
import { useCallback } from "react";
import { api } from "../../convex/_generated/api";
import { listChangeFailedWords } from "../draft/words";
import { refusalOf } from "../shared/refusal";
import { liveShortlist } from "./shortlist/liveShortlist";
import type { ScoutingSeam } from "./seam";

/** The Scouting seam filled in by Convex. */
export const liveScouting: ScoutingSeam = {
  ...liveShortlist,
  useAddToQueue: () => {
    const add = useMutation(api.draft.draftLists.addFromShortlist);
    return useCallback(
      (leagueId, playerCode) => refusalOf(() => add({ leagueId, playerCode }), "Adding a shortlisted player to the draft queue", listChangeFailedWords),
      [add],
    );
  },
  useComparison: (leagueId, codes) => useQuery(api.scouting.compare.players, codes === null ? "skip" : { leagueId, codes: [...codes] }),
  usePlayersList: (leagueId, filters, sort, stat) => useQuery(api.scouting.playersList.list, { leagueId, filters, sort, stat }),
  useStatRace: (leagueId, stat) => useQuery(api.scouting.statRace.teams, { leagueId, stat, descending: true }),
};
