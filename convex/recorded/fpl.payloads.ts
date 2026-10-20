// FPL's bootstrap-static and fixtures, recorded 19 Oct 2026 with gameweek 7 current, cut down:
// all 20 clubs; seven players across FPL's four positions and five of its statuses, one of them
// gone abroad; gameweeks 1, 7 and 8; a finished, a live and an upcoming match. Each kept player,
// gameweek and match has every key FPL sent; bootstrap's other lists are left out.
// For the tests only: the second dot in this file's name keeps it out of Convex's deploy.

import type { RawBootstrap, RawFixture } from "../fpl";
import bootstrap from "./fpl-bootstrap-static.json";
import fixtures from "./fpl-fixtures.json";

export interface FplPayloads {
  bootstrap: RawBootstrap;
  fixtures: RawFixture[];
}

/** A fresh copy of the recorded payloads, safe to change for one test. */
export function recordedFpl(): FplPayloads {
  return structuredClone({ bootstrap: bootstrap as RawBootstrap, fixtures: fixtures as RawFixture[] });
}
