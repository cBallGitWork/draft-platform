import { useMutation, useQuery } from "convex/react";
import { useCallback } from "react";
import { api } from "../../convex/_generated/api";
import { refusalOf } from "../shared/refusal";
import type { MatchupSeam } from "./seam";
import { overrideFailedWords, removeOverrideFailedWords } from "./words";

/** The matchup seam filled in by Convex. A refused override comes back as the server's own words
 *  (convex/table/teamOverrides.ts); any other failure is logged and said plainly. */
export const liveMatchup: MatchupSeam = {
  useMatchup: (leagueId, now, asked) => useQuery(api.matchup.matchup.ofTeam, { leagueId, now, ...asked }),
  useOverrideTeam: () => {
    const override = useMutation(api.table.teamOverrides.overrideTeam);
    return useCallback((leagueId, change) => refusalOf(() => override({ leagueId, ...change }), "Overriding a team's total", overrideFailedWords), [override]);
  },
  useRemoveTeamOverride: () => {
    const remove = useMutation(api.table.teamOverrides.removeTeamOverride);
    return useCallback(
      (leagueId, overridden) => refusalOf(() => remove({ leagueId, ...overridden }), "Removing a team's override", removeOverrideFailedWords),
      [remove],
    );
  },
};
