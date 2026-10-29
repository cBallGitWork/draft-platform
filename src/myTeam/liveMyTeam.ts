import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { refusalOf } from "../shared/refusal";
import { useMinute } from "../shared/useMinute";
import { liveTactics } from "./tactics/liveTactics";
import type { MyTeamSeam, SquadNumberChanges } from "./seam";
import { numberFailedWords } from "./words";

/** My team's seam filled in by Convex. */
export const liveMyTeam: MyTeamSeam = {
  ...liveTactics,
  useTeamFixtures: (leagueId) => useQuery(api.table.teamFixtures.ofMyTeam, { leagueId }),
  useTeamTransactions: (leagueId) => useQuery(api.squads.teamTransactions.ofMyTeam, { leagueId }),
  // Asked at the screen's minute, as a query may not read the clock: the next fixture moves on with it.
  useTeamSquad: (leagueId) => useQuery(api.squads.teamSquad.ofMyTeam, { leagueId, now: useMinute() }),
  useSquadNumbers: function useSquadNumbers() {
    const set = useMutation(api.squads.squadNumbers.set);
    return useMemo<SquadNumberChanges>(
      () => ({ set: (leagueId, playerCode, number) => refusalOf(() => set({ leagueId, playerCode, number }), "Setting a squad number", numberFailedWords) }),
      [set],
    );
  },
};
