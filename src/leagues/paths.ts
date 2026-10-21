/** "Your leagues" (spec/12), which says so when there are none (spec/02): its title, and where it is. */
export const LEAGUES_TITLE = "Your leagues";
export const LEAGUES_PATH = "/leagues";
/** The admin's "Create a league": its title, and where it is. */
export const NEW_LEAGUE_TITLE = "Create a league";
export const NEW_LEAGUE_PATH = `${LEAGUES_PATH}/new`;

/** A page of one league's, as the router matches it, and for one league. */
export function leaguePage<N extends string>(name: N) {
  const route = `${LEAGUES_PATH}/$leagueId/${name}` as const;
  return { route, path: (leagueId: string) => route.replace("$leagueId", leagueId) };
}
