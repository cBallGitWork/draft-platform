/** Where "Your leagues" (spec/12) is. */
export const LEAGUES_PATH = "/leagues";
/** Where the admin's "Create a league" is. */
export const NEW_LEAGUE_PATH = `${LEAGUES_PATH}/new`;

/** A page of one league's, as the router matches it, and for one league. */
export function leaguePage<N extends string>(name: N) {
  const route = `${LEAGUES_PATH}/$leagueId/${name}` as const;
  return { route, path: (leagueId: string) => route.replace("$leagueId", leagueId) };
}
