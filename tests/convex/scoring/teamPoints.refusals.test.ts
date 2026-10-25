import { describe, expect, test } from "vitest";
import type { Lineup } from "../../../convex/lineup/lineup";
import type { Substitution } from "../../../convex/scoring/teamPoints";
import {
  ALL_FINAL,
  ATTACK,
  BELLOUMI,
  DEWSBURY_HALL,
  GELHARDT,
  KEEPER,
  MIDFIELD,
  PHILLIPS,
  RIGHT_BACK,
  team,
  TZOLAKIS,
} from "../../support/convex/teamPoints.harness";

describe("bad input throws rather than score", () => {
  const sub = (substitution: Partial<Substitution>): Substitution[] => [
    { off: GELHARDT, on: BELLOUMI, cell: ATTACK, ...substitution },
  ];

  test.each([
    ["a sub off who isn't a starter", sub({ off: BELLOUMI }), `player ${BELLOUMI} is subbed off but isn't a starter`],
    ["a sub on who isn't on the bench", sub({ on: TZOLAKIS }), `player ${TZOLAKIS} comes on but isn't on the bench`],
    [
      "a starter subbed off twice",
      [...sub({}), ...sub({ on: PHILLIPS, cell: RIGHT_BACK })],
      `player ${GELHARDT} is subbed off twice`,
    ],
    ["a sub coming on twice", [...sub({}), ...sub({ off: TZOLAKIS, cell: KEEPER })], `player ${BELLOUMI} comes on twice`],
    [
      "a sub into a slot someone still counts in",
      sub({ cell: MIDFIELD }),
      `players ${DEWSBURY_HALL} and ${BELLOUMI} both count in midfield/centre`,
    ],
  ])("%s", (_what, substitutions, message) => {
    expect(() => team({ substitutions })).toThrow(message);
  });

  test("a player with no entry in the gameweek's matches, rather than a silent 0", () => {
    const missing = new Map(ALL_FINAL);
    missing.delete(PHILLIPS);
    expect(() => team({ matches: missing })).toThrow(`player ${PHILLIPS} has no entry in the gameweek's matches`);
  });

  test("a bench player with no cell to price him at", () => {
    expect(() => team({ benchCells: new Map([[BELLOUMI, MIDFIELD]]) })).toThrow(
      `bench player ${PHILLIPS} has no cell to price his points at`,
    );
  });

  test("a starter's cell that isn't on the pitch, as scoreMatch refuses it", () => {
    const offPitch: Lineup = {
      starters: [{ playerCode: TZOLAKIS, area: "wing", lane: "centre" }],
      bench: [],
    };
    expect(() => team({ lineup: offPitch, benchCells: new Map() })).toThrow('"wing" is not one of the pitch\'s six areas');
  });
});
