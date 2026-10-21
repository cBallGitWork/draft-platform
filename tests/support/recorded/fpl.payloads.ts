// FPL's bootstrap-static and fixtures, recorded 19 Oct 2026 with gameweek 7 current, cut down:
// all 20 clubs; seven players across FPL's four positions and five of its statuses, one of them
// gone abroad; gameweeks 1, 7 and 8; a finished, a live and an upcoming match. Each kept player,
// gameweek and match has every key FPL sent; bootstrap's other lists are left out.
// The second, fpl-season-kickoffs.json, recorded 20 Oct 2026 with gameweek 7 still current, is the
// whole season for the deadline (#9): all 38 gameweeks and 380 matches, no players, and each club,
// gameweek and match cut to the keys `mapFpl` reads. The first holds too few matches for it: its one
// gameweek 7 match is the Monday's, not the first kickoff. `recordedSeason` lends it the first's
// seven players, since `mapFpl` refuses an empty list (#64); both are 2026/27, so their club ids agree.
// For the tests only: it sits outside convex/, so never deploys.

import type { RawBootstrap, RawFixture } from "../../../convex/football/fpl";
import bootstrap from "./fpl-bootstrap-static.json";
import fixtures from "./fpl-fixtures.json";
import season from "./fpl-season-kickoffs.json";

export interface FplPayloads {
  bootstrap: RawBootstrap;
  fixtures: RawFixture[];
}

/** How many of each the first recording holds. */
export const RECORDED_COUNT = { clubs: 20, players: 7, fixtures: 3, gameweeks: 3 } as const;

/** Season-stable codes of clubs the tests name. */
export const CLUB_CODE = { arsenal: 3, coventry: 9, manCity: 43 } as const;

/** Season-stable codes of players the tests name. */
export const PLAYER_CODE = { haaland: 223094, raya: 154561, saka: 223340 } as const;

/** Season-stable codes of matches the tests name. */
export const FIXTURE_CODE = { arsenalVCoventry: 2645195 } as const;

/** A fresh copy of the first recording, safe to change for one test. */
export function recordedFpl(): FplPayloads {
  return structuredClone({ bootstrap: bootstrap as RawBootstrap, fixtures: fixtures as RawFixture[] });
}

/** A fresh copy of the whole-season recording, with the first's players, safe to change for one test. */
export function recordedSeason(): FplPayloads {
  const whole = structuredClone(season as FplPayloads);
  whole.bootstrap.elements = structuredClone(bootstrap.elements as RawBootstrap["elements"]);
  return whole;
}
