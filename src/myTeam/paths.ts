/** Where another team's squad opens, read-only (#1027), as the router matches it: in a league, from
 *  its name as a player's owner. A plain string, as the player card's route is (playerCard/paths.ts). */
export const OTHER_TEAM_ROUTE = "/leagues/$leagueId/teams/$teamId";

/** One team's squad, read-only, in one league. */
export const otherTeamPath = (leagueId: string, teamId: string) => OTHER_TEAM_ROUTE.replace("$leagueId", leagueId).replace("$teamId", teamId);
