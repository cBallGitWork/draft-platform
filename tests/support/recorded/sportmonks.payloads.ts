// Sportmonks' payloads for the Scottish Premiership (#1391). NOT YET RECORDED: no token reached
// the build that wrote these, so both are shaped from Sportmonks' v3 docs (fixtures with
// participants, scores, periods, lineups.details and events; teams with players.player; a
// season's schedule), cut to one live Celtic v Rangers, a finished and an upcoming match, and
// three clubs. Once SPORTMONKS_API_TOKEN reads one on the dev deployment, swap each for the read.
// sportmonks-season.json holds the three six-hourly reads' `data`; sportmonks-fixture.json one
// whole live read, `fixtures/multi` with its includes.

import type { RawFixture, SportmonksPayloads } from "../../../convex/football/sportmonks/sportmonksRaw";
import liveRead from "./sportmonks-fixture.json";
import season from "./sportmonks-season.json";

/** The ids the tests name. */
export const SM = {
  celtic: 53,
  rangers: 62,
  hearts: 273,
  oldFirm: 19134512,
  rangersHearts: 19134506,
  heartsCeltic: 19134513,
  schmeichel: 37292381,
  kyogo: 37306481,
  mcCowan: 37410025,
  tavernier: 31739,
} as const;

/** The six-hourly read's three bodies' `data`, a fresh copy each call. */
export function sportmonksSeason(): SportmonksPayloads {
  return structuredClone(season) as unknown as SportmonksPayloads;
}

/** One live read's body, whole, a fresh copy each call. */
export function sportmonksLiveRead(): { data: RawFixture[] } {
  return structuredClone(liveRead) as unknown as { data: RawFixture[] };
}
