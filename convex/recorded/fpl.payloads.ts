// FPL's bootstrap-static and fixtures, recorded 19 Oct 2026 with gameweek 7 current, cut down:
// all 20 clubs; seven players across FPL's four positions and five of its statuses, one of them
// gone abroad; gameweeks 1, 7 and 8; a finished, a live and an upcoming match. Each kept player,
// gameweek and match has every key FPL sent; bootstrap's other lists are left out.
// The second, fpl-season-kickoffs.json, recorded 20 Oct 2026 with gameweek 7 still current, is the
// whole season for the deadline (#9): all 38 gameweeks and 380 matches, no players, and each club,
// gameweek and match cut to the keys `mapFpl` reads. The first holds too few matches for it: its one
// gameweek 7 match is the Monday's, not the first kickoff.
// For the tests only: the second dot in this file's name keeps it out of Convex's deploy.

import type { RawBootstrap, RawFixture } from "../fpl";
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

/** A fresh copy of the first recording, safe to change for one test. */
export function recordedFpl(): FplPayloads {
  return structuredClone({ bootstrap: bootstrap as RawBootstrap, fixtures: fixtures as RawFixture[] });
}

/** A fresh copy of the whole-season recording, safe to change for one test. */
export function recordedSeason(): FplPayloads {
  return structuredClone(season as FplPayloads);
}
