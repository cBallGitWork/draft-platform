import { PREMIER_LEAGUE_PATH } from "../frame/menu";

// Where a real match's page is (#45; spec/10, The match page), and a real club's (#1936; spec/18,
// Club pages): under the Football section, whose tab stays lit there, the same for every league,
// read in the one the app is in.

/** The match page's route, as the router matches it. */
export const MATCH_ROUTE = `${PREMIER_LEAGUE_PATH}/match/$fixtureCode`;

/** One match's page, by FPL's season-stable fixture code. */
export const matchPath = (fixtureCode: number) => MATCH_ROUTE.replace("$fixtureCode", String(fixtureCode));

/** A club's page's route, as the router matches it. */
export const CLUB_ROUTE = `${PREMIER_LEAGUE_PATH}/club/$clubCode`;

/** One club's page, by its code. */
export const clubPath = (clubCode: number) => CLUB_ROUTE.replace("$clubCode", String(clubCode));
