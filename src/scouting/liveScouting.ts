import { useMutation, useQuery } from "convex/react";
import { useCallback, useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { listOf, withFirstRuns } from "../../convex/scouting/playersOrder";
import { mostFirst } from "../../convex/scouting/raceOrder";
import { listChangeFailedWords } from "../draft/words";
import { liveClaims } from "../myTeam/claims/liveClaims";
import { livePlayerCard } from "../playerCard/livePlayerCard";
import { refusalOf } from "../shared/refusal";
import { useLastLoaded } from "../shared/useLastLoaded";
import { useMinute } from "../shared/useMinute";
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
  // Held across the minute's turn, so Compare doesn't vanish while the next answer loads (#1747).
  useYourPlayer: (leagueId, playerCode, now) =>
    useLastLoaded(useQuery(api.scouting.yourPlayer.at, { leagueId, playerCode, now }), `${leagueId}/${playerCode}`),
  usePer90: (leagueId, playerCode, stat, period) => useQuery(api.scouting.per90.figures, { leagueId, playerCode, stat, period }),
  // Only the club and the period and stat are asked of the server; who holds him, his position and
  // the order are worked here on the one list loaded, so they never read it again (#1552). The kept
  // player (#1551) is asked of the server only while a club is chosen, since every club's list
  // already holds every current player, so a click with none chosen never reads it again either.
  // The run that can first take each player on waivers moves with the clock, so it comes from a
  // small query of its own, asked each minute, and the list is never read again for it (#1467); its
  // last answer holds while the next minute's loads, so a run time never flashes off (#1777).
  usePlayersList: (leagueId, filters, sort, stat, period, keep) => {
    const loaded = useQuery(api.scouting.playersList.list, { leagueId, clubCode: filters.clubCode, stat, period, keep: filters.clubCode === null ? undefined : keep });
    const runs = useLastLoaded(useQuery(api.scouting.playersList.firstRuns, { leagueId, now: useMinute() }), leagueId);
    return useMemo(() => {
      if (loaded === undefined) return undefined;
      const listed = { ...loaded, players: withFirstRuns(listOf(loaded.players, filters, sort), runs), kept: undefined };
      if (keep === undefined) return listed;
      const kept = loaded.kept ?? loaded.players.find(({ code }) => code === keep) ?? null;
      return { ...listed, kept: kept === null ? null : withFirstRuns([kept], runs)[0] };
    }, [loaded, runs, filters, sort, keep]);
  },
  useStatRace: (leagueId, stat) => useQuery(api.scouting.statRace.teams, { leagueId, stat, descending: mostFirst(stat) }),
};
