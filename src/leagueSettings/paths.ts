/** Where a league's settings are edited, as the router matches it. A plain string, not
 *  `leaguePage("settings")`, so .claude/hooks/screen_routes.py can read it and find the files
 *  rendering the settings' approved picture, as the player card's (../playerCard/paths.ts). */
export const SETTINGS_ROUTE = "/leagues/$leagueId/settings";

/** One league's settings. */
export const settingsPath = (leagueId: string) => SETTINGS_ROUTE.replace("$leagueId", leagueId);
