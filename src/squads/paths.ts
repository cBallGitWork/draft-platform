import { LEAGUES_PATH } from "../leagues/paths";

/** Where a league's squads are filled (#31), as the router matches it, and for one league. */
export const SQUADS_ROUTE = `${LEAGUES_PATH}/$leagueId/squads`;
export const squadsPath = (leagueId: string) => SQUADS_ROUTE.replace("$leagueId", leagueId);
