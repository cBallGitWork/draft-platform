import { leaguePage } from "../leagues/paths";

/** Where Player scoring, the site's scoring, opens from a league (#30, #354), as the router matches
 *  it, and for one league. */
export const { route: SCORING_ROUTE, path: scoringPath } = leaguePage("scoring");
