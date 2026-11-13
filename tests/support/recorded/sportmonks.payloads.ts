// Sportmonks' payloads for the Scottish Premiership (#1391), two sets.
//
// sportmonks-docs-season.json and sportmonks-docs-fixture.json (SM, sportmonksSeason,
// sportmonksLiveRead) are shaped from Sportmonks' v3 docs, not read: fixtures with participants,
// scores, periods, lineups.details and events; teams with players.player and sidelined.type, an
// open injury, a finished one and an open suspension (#1420), venue and coaches.coach, Celtic's
// caretaker after a past manager, Rangers' ground with no capacity and no coach, Hearts' with
// neither (#1938); a season's schedule. They are cut to one live Celtic v Rangers, a finished and
// an upcoming match, and three clubs, the cases a real read hasn't yet carried.
//
// sportmonks-season.json and sportmonks-fixture.json (SM_REAL, sportmonksRealSeason,
// sportmonksRealLiveRead) are real reads on the dev deployment on 10 Nov 2026 by
// football/sportmonks/sportmonksRecording:read, during the international break, so no match was
// live, and before the venue, coaches and sidelined includes were asked for. The season is cut to
// three clubs (Celtic, Kilmarnock, St. Mirren), a few men of each squad, and rounds 13 to 15's
// matches between them; the fixture is one whole `fixtures/multi` read with its includes, of
// Celtic 1-0 Kilmarnock on 8 Nov 2026. Fields are as sent: only whole rows were left out.
//
// Each set's season holds the three six-hourly reads' `data`; its fixture one whole live read.

import type { RawFixture, SportmonksPayloads } from "../../../convex/football/sportmonks/sportmonksRaw";
import liveRead from "./sportmonks-docs-fixture.json";
import season from "./sportmonks-docs-season.json";
import realLiveRead from "./sportmonks-fixture.json";
import realSeason from "./sportmonks-season.json";
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

/** The ids the real reads' tests name. */
export const SM_REAL = {
  celtic: 53,
  kilmarnock: 180,
  stMirren: 496,
  celticKilmarnock: 19722750,
  celticStMirren: 19722745,
  stMirrenKilmarnock: 19722734,
  // In the season's squads.
  owen: 37674481,
  trusty: 262280,
  donovan: 37732189,
  ramsey: 37260590,
  // In Celtic v Kilmarnock's lineups.
  sinisalo: 529045,
  scales: 123659,
  jota: 163711,
  nygren: 19979885,
  mcGregor: 8585,
} as const;

/** The real six-hourly read's three bodies' `data`, a fresh copy each call. */
export function sportmonksRealSeason(): SportmonksPayloads {
  return structuredClone(realSeason) as unknown as SportmonksPayloads;
}

/** The real read of Celtic v Kilmarnock, whole, a fresh copy each call. */
export function sportmonksRealLiveRead(): { data: RawFixture[] } {
  return structuredClone(realLiveRead) as unknown as { data: RawFixture[] };
}

// sportmonks-pl-season.json (#1421): the Premier League's six-hourly read. NOT YET RECORDED
// either: the Premier League needs the paid plan, not yet on. Shaped as sportmonks-docs-season.json is,
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
