import { leaguePage } from "../leagues/paths";

/** Where a league's gameweeks are ticked (#74), as the router matches it, and for one league. */
export const { route: GAMEWEEKS_ROUTE, path: gameweeksPath } = leaguePage("gameweeks");
