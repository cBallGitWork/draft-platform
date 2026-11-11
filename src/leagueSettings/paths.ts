/** Where a league's settings are edited, as the router matches it, written out whole so the PR guard
 *  can trace the route to its approved picture (docs/design/approved/settings/), as the player
 *  card's is. */
export const SETTINGS_ROUTE = "/leagues/$leagueId/settings";
/** The settings page's draft panel, where the draft room's "Change the start" opens it (#1476). */
export const SETTINGS_DRAFT_HASH = "draft";
/** One league's settings. */
export const settingsPath = (leagueId: string) => SETTINGS_ROUTE.replace("$leagueId", leagueId);
