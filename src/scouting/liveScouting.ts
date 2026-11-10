import { useMutation, useQuery } from "convex/react";
import { useCallback } from "react";
import { api } from "../../convex/_generated/api";
import { listChangeFailedWords } from "../draft/words";
import { liveClaims } from "../myTeam/claims/liveClaims";
import { livePlayerCard } from "../playerCard/livePlayerCard";
import { refusalOf } from "../shared/refusal";
import { liveScouts } from "./scouts/liveScouts";
import { liveShortlist } from "./shortlist/liveShortlist";
import type { ScoutingSeam } from "./seam";

/** The Scouting seam filled in by Convex. */
export const liveScouting: ScoutingSeam = {
  ...liveShortlist,
  ...liveScouts,
  useCardAction: livePlayerCard.useCardAction,
  useWaiverChanges: livePlayerCard.useWaiverChanges,
  usePendingClaims: liveClaims.usePendingClaims,
  useAddToQueue: () => {
    const add = useMutation(api.draft.draftLists.addFromShortlist);
    return useCallback(
      (leagueId, playerCode) => refusalOf(() => add({ leagueId, playerCode }), "Adding a shortlisted player to the draft queue", listChangeFailedWords),
      [add],
    );
  },
  useComparison: (leagueId, codes, stat, period) => useQuery(api.scouting.compare.players, codes === null ? "skip" : { leagueId, codes: [...codes], stat, period }),
  useYourPlayer: (leagueId, playerCode, now) => useQuery(api.scouting.yourPlayer.at, { leagueId, playerCode, now }),
  usePer90: (leagueId, playerCode, stat, period) => useQuery(api.scouting.per90.figures, { leagueId, playerCode, stat, period }),
  usePlayersList: (leagueId, filters, sort, stat, period) => useQuery(api.scouting.playersList.list, { leagueId, filters, sort, stat, period }),
};
