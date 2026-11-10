import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { refusalOf } from "../shared/refusal";
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
  // Asked at the screen's minute, as a query may not read the clock: the next fixture moves on with it.
  useTeamSquad: (leagueId) => useQuery(api.squads.teamSquad.ofMyTeam, { leagueId, now: useMinute() }),
  useOtherSquad: (leagueId, teamId) => useQuery(api.squads.otherSquad.ofTeam, { leagueId, teamId }),
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
