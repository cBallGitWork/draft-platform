/** Where a league's squads are filled (#31), as the router matches it, written out whole so the PR guard
 *  can trace the route to its approved picture (docs/design/approved/auto-team/), as League settings' is. */
export const SQUADS_ROUTE = "/leagues/$leagueId/squads";
/** One league's squads. */
export const squadsPath = (leagueId: string) => SQUADS_ROUTE.replace("$leagueId", leagueId);
