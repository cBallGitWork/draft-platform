import { useMutation, useQuery } from "convex/react";
import { useCallback, useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { listOf } from "../../convex/scouting/playersOrder";
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
  // Only the club and the period and stat are asked of the server; who holds him, his position and
  // the order are worked here on the one list loaded, so they never read it again (#1552). The kept
  // player (#1551) is asked of the server only while a club is chosen, since every club's list
  // already holds every current player, so a click with none chosen never reads it again either.
  usePlayersList: (leagueId, filters, sort, stat, period, keep) => {
    const loaded = useQuery(api.scouting.playersList.list, { leagueId, clubCode: filters.clubCode, stat, period, keep: filters.clubCode === null ? undefined : keep });
    return useMemo(() => {
      if (loaded === undefined) return undefined;
      const listed = { ...loaded, players: listOf(loaded.players, filters, sort) };
      if (keep === undefined) return listed;
      return { ...listed, kept: loaded.kept ?? loaded.players.find(({ code }) => code === keep) ?? null };
    }, [loaded, filters, sort, keep]);
  },
  useStatRace: (leagueId, stat) => useQuery(api.scouting.statRace.teams, { leagueId, stat, descending: true }),
};
