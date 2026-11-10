// Sportmonks' payloads for the Scottish Premiership (#1391), read on the dev deployment on 10 Nov
// 2026 by football/sportmonks/sportmonksRecording:read, during the international break, so no
// match was live. sportmonks-season.json holds the three six-hourly reads' `data`, cut to three
// clubs (Celtic, Kilmarnock, St. Mirren), a few men of each squad, and rounds 13 to 15's matches
// between them; sportmonks-fixture.json one whole `fixtures/multi` read with its includes, of
// Celtic 1-0 Kilmarnock on 8 Nov 2026. Fields are as sent: only whole rows were left out.

import type { RawFixture, SportmonksPayloads } from "../../../convex/football/sportmonks/sportmonksRaw";
import liveRead from "./sportmonks-fixture.json";
import season from "./sportmonks-season.json";

/** The ids the tests name. */
export const SM = {
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

/** The six-hourly read's three bodies' `data`, a fresh copy each call. */
export function sportmonksSeason(): SportmonksPayloads {
  return structuredClone(season) as unknown as SportmonksPayloads;
}

/** One live read's body, whole, a fresh copy each call. */
export function sportmonksLiveRead(): { data: RawFixture[] } {
  return structuredClone(liveRead) as unknown as { data: RawFixture[] };
}
