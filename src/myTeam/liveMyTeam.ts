import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { clockHourOf } from "../../convex/home/homeAt";
import { teamSquadAt } from "../../convex/squads/teamSquadAt";
import { refusalOf } from "../shared/refusal";
import { useLastLoaded } from "../shared/useLastLoaded";
import { useMinute } from "../shared/useMinute";
import { liveTactics } from "./tactics/liveTactics";
import { liveClaims } from "./claims/liveClaims";
import { liveTable } from "../table/liveTable";
import { changeFailedWords } from "../shared/words";
import type { AutoTeamChanges, MyTeamSeam, SquadNumberChanges } from "./seam";
import { numberFailedWords } from "./squad/words";

/** Switching a team's auto team, through Convex: My team's and Squads' seams both use it. */
export function useLiveAutoTeamChanges(): AutoTeamChanges {
  const set = useMutation(api.lineup.autoTeam.set);
  return useMemo<AutoTeamChanges>(
    () => ({
      set: (leagueId, teamId, on, endsAfter) =>
        refusalOf(() => set({ leagueId, teamId, on, ...(endsAfter === undefined ? {} : { endsAfter }) }), "Switching the auto team", changeFailedWords),
    }),
    [set],
  );
}

/** My team's seam filled in by Convex. */
export const liveMyTeam: MyTeamSeam = {
  ...liveTactics,
  ...liveTable,
  ...liveClaims,
  useTeamFixtures: (leagueId) => useQuery(api.table.teamFixtures.ofMyTeam, { leagueId }),
  useTeamTransactions: (leagueId) => useQuery(api.squads.teamTransactions.ofMyTeam, { leagueId }),
  // Asked for the hour, never the minute (#2008): the next fixtures and the Schedule view's
  // gameweeks move on with the clock, so they are kept to the screen's minute here (teamSquadAt.ts).
  // The last is held while the next hour's loads, so the tab doesn't blank at the hour's turn.
  useTeamSquad: function useTeamSquad(leagueId) {
    const minute = useMinute();
    const loaded = useQuery(api.squads.teamSquad.ofMyTeam, { leagueId, hour: clockHourOf(minute) });
    return useLastLoaded(useMemo(() => loaded && teamSquadAt(loaded, minute), [loaded, minute]), leagueId);
  },
  useOtherSquad: (leagueId, teamId) => useQuery(api.squads.otherSquad.ofTeam, { leagueId, teamId }),
  useTeamAwards: (leagueId, teamId) => useQuery(api.table.teamAwards.ofTeam, teamId === null ? "skip" : { leagueId, teamId }),
  // My team is for a signed-in manager, so the query is never skipped as Mail's is.
  useLatestMail: () => useQuery(api.mail.mail.latest, {}),
  useSquadNumbers: function useSquadNumbers() {
    const set = useMutation(api.squads.squadNumbers.set);
    return useMemo<SquadNumberChanges>(
      () => ({ set: (leagueId, playerCode, number) => refusalOf(() => set({ leagueId, playerCode, number }), "Setting a squad number", numberFailedWords) }),
      [set],
    );
  },
  useMyAutoTeam: (leagueId) => useQuery(api.lineup.autoTeam.ofMyTeam, { leagueId }),
  useAutoTeamChanges: useLiveAutoTeamChanges,
};
