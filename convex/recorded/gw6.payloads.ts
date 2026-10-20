// Gameweek 6 of 2026/27 from both feeds, recorded 20 Oct 2026. It is the last gameweek FPL calls
// finished: gameweek 7's matches had all been played, but FPL had not signed it off.
// Kept, every key on each kept object, the lists cut:
// - FPL bootstrap-static: the 40 men named for Hull v Everton, and gameweeks 6 and 7.
// - FPL /event/6/live/: the same 40. /fixtures/: gameweek 6's ten matches, with their stats.
// - The Premier League's gameweek 6 fixture list, read with `altIds=true`: all ten.
// - Six of its fixtures in full, twelve team sheets: Hull v Everton whole; for the other five, no
//   `events` and two substitutes a side.
// - Per-player stats (`/stats/player/{id}?fixtures=`, keyed here by fixture and player) for every
//   man named for Hull v Everton and the 22 starters at Palace v Forest. Every stat is kept for the
//   six men in `FULL_STATS`; for the rest, only where they played and for how long.
// For the tests only: the second dot in this file's name keeps it out of Convex's deploy.

import type { RawBootstrap, RawFixture } from "../fpl";
import type { RawLive } from "../fplLive";
import type { RawPlFixture, RawPlFixturePage, RawPlPlayerStats } from "../premierLeague";
import bootstrap from "./fpl-gw6-bootstrap.json";
import fplFixtures from "./fpl-gw6-fixtures.json";
import live from "./fpl-gw6-live.json";
import plFixtures from "./pl-gw6-fixtures.json";
import round from "./pl-gw6-round.json";
import playerStats from "./pl-gw6-player-stats.json";

export interface Gw6Payloads {
  fpl: {
    bootstrap: Pick<RawBootstrap, "elements" | "events">;
    fixtures: RawFixture[];
    live: RawLive;
  };
  pl: {
    round: RawPlFixturePage;
    fixtures: RawPlFixture[];
    playerStats: { fixture: number; player: number; payload: RawPlPlayerStats }[];
  };
}

/** Each recorded match by both feeds' ids: the Premier League's fixture id and FPL's fixture code. */
export const MATCH = {
  arsenalLeeds: { pl: 128973, code: 2645245 },
  villaBrentford: { pl: 128974, code: 2645246 },
  chelseaBournemouth: { pl: 128975, code: 2645247 },
  coventryNewcastle: { pl: 128976, code: 2645248 },
  palaceForest: { pl: 128977, code: 2645249 },
  hullEverton: { pl: 128978, code: 2645250 },
} as const;

/** The men whose every stat is kept, by FPL code and the Premier League's id. */
export const FULL_STATS = {
  phillips: { code: 167825, pl: 8339 }, // Hull's keeper, an unused substitute
  coyle: { code: 193278, pl: 13486 }, // Hull's right back
  mcBurnie: { code: 169432, pl: 8107 }, // Hull's striker
  belloumi: { code: 540324, pl: 137549 }, // Hull, on at 64 minutes
  johnson: { code: 242898, pl: 49374 }, // Everton's right winger, off at 66
  grealish: { code: 114283, pl: 4260 }, // Everton's left attacking midfielder, off at 86
} as const;

/** A fresh copy of the recorded payloads, safe to change for one test. */
export function recordedGw6(): Gw6Payloads {
  return structuredClone({
    fpl: {
      bootstrap: bootstrap as Gw6Payloads["fpl"]["bootstrap"],
      fixtures: fplFixtures as RawFixture[],
      live: live as RawLive,
    },
    pl: {
      round: round as RawPlFixturePage,
      fixtures: plFixtures as RawPlFixture[],
      playerStats: playerStats as Gw6Payloads["pl"]["playerStats"],
    },
  });
}

/** One recorded Premier League fixture in full, a fresh copy. */
export function recordedPlFixture(plId: number): RawPlFixture {
  const fixture = (plFixtures as RawPlFixture[]).find((each) => each.id === plId);
  if (fixture === undefined) throw new Error(`no recorded Premier League fixture ${plId}`);
  return structuredClone(fixture);
}

/** The recorded FPL players less those with these codes, as if FPL had not listed them yet. */
export function fplElementsWithout(...codes: number[]): RawBootstrap["elements"] {
  return structuredClone(bootstrap.elements.filter((element) => !codes.includes(element.code)));
}

/** The recorded Premier League stats reads for one match, by the Premier League's player id. */
export function plReadsFor(payloads: Gw6Payloads, plFixtureId: number): Map<number, RawPlPlayerStats> {
  return new Map(
    payloads.pl.playerStats.filter((read) => read.fixture === plFixtureId).map((read) => [read.player, read.payload]),
  );
}
