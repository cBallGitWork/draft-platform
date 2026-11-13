// Sportmonks' payloads for the Scottish Premiership (#1391). NOT YET RECORDED: no token reached
// the build that wrote these, so both are shaped from Sportmonks' v3 docs (fixtures with
// participants, scores, periods, lineups.details and events; teams with players.player and
// sidelined.type, an open injury, a finished one and an open suspension (#1420), venue and
// coaches.coach, Celtic's caretaker after a past manager, Rangers' ground with no capacity and no
// coach, Hearts' with neither (#1938); a
// season's schedule), cut to one live Celtic v Rangers, a finished and an upcoming match, and
// three clubs. Once SPORTMONKS_API_TOKEN reads one on the dev deployment, swap each for the read.
// sportmonks-season.json holds the three six-hourly reads' `data`; sportmonks-fixture.json one
// whole live read, `fixtures/multi` with its includes.

import type { RawFixture, SportmonksPayloads } from "../../../convex/football/sportmonks/sportmonksRaw";
import liveRead from "./sportmonks-fixture.json";
import season from "./sportmonks-season.json";
import plSeason from "./sportmonks-pl-season.json";

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

// sportmonks-pl-season.json (#1421): the Premier League's six-hourly read. NOT YET RECORDED
// either: the Premier League needs the paid plan, not yet on. Shaped as sportmonks-season.json is,
// and cut to mirror fpl-bootstrap-static.json and fpl-fixtures.json: their seven men and three
// matches, the clubs those name, and two men FPL doesn't list, an academy keeper and a youngster
// with no date of birth sent. Swap it for a real read once the paid trial's token is on dev.

/** The Premier League ids the tests name. */
export const SM_PL = {
  arsenal: 19,
  manCity: 9,
  saka: 32982,
  haaland: 154421,
  /** The two men FPL doesn't list. */
  wrenfield: 90000001,
  oyelaran: 90000002,
  arsenalCoventry: 19400001,
} as const;

/** The Premier League's six-hourly read's three bodies' `data`, a fresh copy each call. */
export function sportmonksPremierLeague(): SportmonksPayloads {
  return structuredClone(plSeason) as unknown as SportmonksPayloads;
}
