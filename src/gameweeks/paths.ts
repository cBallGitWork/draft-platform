import { LEAGUES_PATH } from "../leagues/paths";

/** Where a league's gameweeks are ticked (#74), as the router matches it, and for one league. */
export const GAMEWEEKS_ROUTE = `${LEAGUES_PATH}/$leagueId/gameweeks`;
export const gameweeksPath = (leagueId: string) => GAMEWEEKS_ROUTE.replace("$leagueId", leagueId);
