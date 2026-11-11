import { useMutation, useQuery } from "convex/react";
import { useCallback, useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { matchupAt } from "../../convex/matchup/commentaryAt";
import { refusalOf } from "../shared/refusal";
import { useLastLoaded } from "../shared/useLastLoaded";
import type { MatchupSeam } from "./seam";
import { overrideFailedWords, removeOverrideFailedWords } from "./words";

/** The matchup seam filled in by Convex. Only the small query saying which gameweek it opens on
 *  takes the minute, and only with none asked; the matchup itself takes the gameweek, so it is read
 *  again only when its data changes (#1550; commentaryAt.ts). That gameweek's last read is held
 *  while the next loads, so the matchup keeps its place. A refused override comes back as the
 *  server's own words (convex/table/teamOverrides.ts); any other failure is logged and said plainly. */
export const liveMatchup: MatchupSeam = {
  useMatchup: (leagueId, now, asked) => {
    const opened = useLastLoaded(
      useQuery(api.matchup.matchupGameweek.thisGameweek, asked.gameweek === undefined ? { leagueId, now, teamId: asked.teamId } : "skip"),
      `${leagueId}/${asked.teamId}`,
    );
    const gameweek = asked.gameweek ?? opened;
    const held = useQuery(api.matchup.matchup.ofTeam, gameweek === undefined ? "skip" : { leagueId, ...asked, gameweek });
    return useMemo(() => (held === undefined ? undefined : matchupAt(held, now)), [held, now]);
  },
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
