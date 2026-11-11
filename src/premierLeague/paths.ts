import { PREMIER_LEAGUE_PATH } from "../frame/menu";

// Where a real match's page is (#45; spec/10, The match page): under the Premier League section,
// whose tab stays lit there, the same match for every league, read in the one the app is in.

/** The match page's route, as the router matches it: PREMIER_LEAGUE_PATH's, written out, since the
 *  pull request guard reads a route's constant only as a plain literal (.claude/hooks/screen_routes.py). */
export const MATCH_ROUTE = "/premier-league/match/$fixtureCode";
MATCH_ROUTE satisfies `${typeof PREMIER_LEAGUE_PATH}/match/$fixtureCode`;

/** One match's page, by FPL's season-stable fixture code. */
export const matchPath = (fixtureCode: number) => MATCH_ROUTE.replace("$fixtureCode", String(fixtureCode));
