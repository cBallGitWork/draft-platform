import { useMutation, useQuery } from "convex/react";
import { useCallback, useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { matchupAt } from "../../convex/matchup/commentaryAt";
import { thisGameweekAt } from "../../convex/gameweeks/nextGameweek";
import { refusalOf } from "../shared/refusal";
import type { MatchupSeam } from "./seam";
import { overrideFailedWords, removeOverrideFailedWords } from "./words";

/** The matchup seam filled in by Convex. No query takes the minute: with no gameweek asked, the
 *  team's gameweeks come with their deadlines and the one it opens on is judged here at the minute
 *  (#2008); the matchup itself takes the gameweek, so both are read again only when their data
 *  changes (#1550; commentaryAt.ts). A refused override comes back as the server's own words
 *  (convex/table/teamOverrides.ts); any other failure is logged and said plainly. */
export const liveMatchup: MatchupSeam = {
  useMatchup: (leagueId, now, asked) => {
    const gameweeks = useQuery(api.matchup.matchupGameweek.gameweeksOf, asked.gameweek === undefined ? { leagueId, teamId: asked.teamId } : "skip");
    const opened = gameweeks === undefined ? undefined : gameweeks === null ? null : thisGameweekAt(gameweeks, now);
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
