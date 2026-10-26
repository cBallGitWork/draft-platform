import { PREMIER_LEAGUE_PATH } from "../frame/menu";

// Where a real match's page is (#45; spec/10, The match page): under the Premier League section,
// whose tab stays lit there, the same match for every league, read in the one the app is in.

/** The match page's route, as the router matches it. */
export const MATCH_ROUTE = `${PREMIER_LEAGUE_PATH}/match/$fixtureCode` as const;

/** One match's page, by FPL's season-stable fixture code. */
export const matchPath = (fixtureCode: number) => MATCH_ROUTE.replace("$fixtureCode", String(fixtureCode));
