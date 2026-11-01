import { describe, expect, test } from "vitest";
import { DEFAULT_ROLES } from "../../../convex/lineup/roles";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { scoreMatch } from "../../../convex/scoring/scoring";
import type { ScoringSet } from "../../../convex/scoring/scoringSet";
import {
  countedMatches,
  LEAST_MATCHES_RATED,
  LOWEST_STARS,
  perMatchUnder,
  ratedRoles,
  STAR_CUTS,
  STARS_WINDOW,
  starsFor,
  type RatedRecord,
} from "../../../convex/stars/stars";
import { NO_DATA, UNSURE } from "../../../convex/stars/starsShape";

// Stars (#11; spec/05 Roles; Craig, 1 Nov 2026): a rating ranks a player's points per match under a
// role against everyone rated who plays its area.

/** A pool of 100 rated players scoring 1 to 100 a match: the player scoring `perMatch` has
 *  100 − perMatch above him. */
const HUNDRED = Array.from({ length: 100 }, (_, index) => index + 1);

describe("a player's stars for a role", () => {
  test("five for the top 5%: four or fewer of a hundred above him", () => {
    expect(starsFor(LEAST_MATCHES_RATED, 100, HUNDRED)).toBe(5);
    expect(starsFor(LEAST_MATCHES_RATED, 96, HUNDRED)).toBe(5);
    expect(starsFor(LEAST_MATCHES_RATED, 95, HUNDRED)).toBe(4.5);
  });

  test("each first cut point: 4.5 from the 85th percentile down to 1 from the 15th, half a star below", () => {
    // Craig's first cut points (1 Nov 2026), each the most above him for it in a pool of a hundred.
    const lowestFor = [
      [5, 96],
      [4.5, 86],
      [4, 76],
      [3.5, 66],
      [3, 56],
      [2.5, 46],
      [2, 36],
      [1.5, 26],
      [1, 16],
    ] as const;
    for (const [stars, perMatch] of lowestFor) {
      expect(starsFor(LEAST_MATCHES_RATED, perMatch, HUNDRED)).toBe(stars);
      expect(starsFor(LEAST_MATCHES_RATED, perMatch - 1, HUNDRED)).toBeLessThan(stars);
    }
    expect(starsFor(LEAST_MATCHES_RATED, 15, HUNDRED)).toBe(LOWEST_STARS);
    expect(starsFor(LEAST_MATCHES_RATED, 1, HUNDRED)).toBe(LOWEST_STARS);
    expect(STAR_CUTS.map((cut) => cut.stars)).toEqual([5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1]);
  });

  test("players level on points per match get the same stars", () => {
    const pool = [6, 6, 6, 6];
    expect(new Set(pool.map((perMatch) => starsFor(LEAST_MATCHES_RATED, perMatch, pool)))).toEqual(new Set([5]));
  });

  test("the only rated player in his area is its best", () => {
    expect(starsFor(LEAST_MATCHES_RATED, 2, [2])).toBe(5);
  });

  test("“?” under three matches and “—” with none, whatever he scored", () => {
    expect(starsFor(LEAST_MATCHES_RATED - 1, 100, HUNDRED)).toBe(UNSURE);
    expect(starsFor(1, 100, HUNDRED)).toBe(UNSURE);
    expect(starsFor(0, 100, HUNDRED)).toBe(NO_DATA);
  });

  test("a rated player with no pool is a bug, said, never a guess", () => {
    expect(() => starsFor(LEAST_MATCHES_RATED, 5, [])).toThrow(/pool holds no one/);
  });
});

describe("the roles a player is rated for", () => {
  const keysIn = (positions: Parameters<typeof ratedRoles>[0], area: string) =>
    ratedRoles(positions)
      .filter((rated) => rated.area === area)
      .map((rated) => rated.role);

  test("every role in every area his positions play: a centre-back's are the whole defence's", () => {
    expect(new Set(ratedRoles(["CB"]).map((rated) => rated.area))).toEqual(new Set(["defence"]));
    expect(keysIn(["CB"], "defence")).toEqual([...DEFAULT_ROLES.FB, ...DEFAULT_ROLES.CB, ...DEFAULT_ROLES.SW].map((role) => role.key));
  });

  test("a wing-back is rated in defence and both midfield rows", () => {
    expect([...new Set(ratedRoles(["WB"]).map((rated) => rated.area))]).toEqual(["defence", "defensiveMidfield", "midfield"]);
    expect(keysIn(["WB"], "defensiveMidfield")).toEqual([...DEFAULT_ROLES.WB, ...DEFAULT_ROLES.CDM].map((role) => role.key));
  });

  test("a shadow striker is rated apart at number 10 and up front, each priced in its own area", () => {
    const shadow = ratedRoles(["SS"]).filter((rated) => rated.role === "shadowStriker");
    expect(shadow.map((rated) => rated.area)).toEqual(["attackingMidfield", "attack"]);
    expect(shadow.map((rated) => rated.cell)).toEqual([
      { area: "attackingMidfield", lane: "leftCentre" },
      { area: "attack", lane: "left" },
    ]);
  });

  test("none for a player with no position yet", () => {
    expect(ratedRoles([])).toEqual([]);
  });
});

describe("the matches he is rated on", () => {
  const KICKOFF = Date.parse("2026-10-24T14:00:00Z");
  const HOUR = 60 * 60 * 1000;
  const record = (minutes: number, at: number, parts: Partial<RatedRecord> = {}): RatedRecord => ({
    state: "locked",
    played: minutes > 0,
    arrived: { fpl: true, pl: true },
    stats: { minutes, goals_scored: at },
    kickoff: KICKOFF + at * HOUR,
    ...parts,
  });

  test("each final match he got on the pitch for, a cameo included, newest first", () => {
    const counted = countedMatches([record(90, 1), record(3, 2), record(0, 3, { played: false })]);
    expect(counted.map((stats) => stats.goals_scored)).toEqual([2, 1]);
  });

  test("not one still open to correction, nor one whose record hasn't wholly arrived", () => {
    expect(countedMatches([record(90, 1, { state: "complete" }), record(90, 2, { state: "provisional" })])).toEqual([]);
    expect(countedMatches([record(90, 1, { arrived: { fpl: true, pl: false } })])).toEqual([]);
  });

  test(`only his newest ${STARS_WINDOW}`, () => {
    const many = Array.from({ length: STARS_WINDOW + 2 }, (_, index) => record(90, index));
    const counted = countedMatches(many.toReversed());
    expect(counted).toHaveLength(STARS_WINDOW);
    expect(counted.at(-1)?.goals_scored).toBe(2);
  });
});

describe("his points per match under a role", () => {
  const STRIKER = { area: "attack", lane: "centre" } as const;
  const POACHING: ScoringSet = { ...FIRST_SCORING, roleAdjustments: [{ role: "poacher", adjustments: [{ stat: "goals_scored", points: 1 }] }] };
  const MATCHES = [
    { minutes: 90, goals_scored: 2 },
    { minutes: 20, goals_scored: 0 },
  ];

  test("his matches' totals under the role, the site's scoring and its adjustment, averaged", () => {
    const totals = MATCHES.map((stats) => scoreMatch(stats, POACHING, STRIKER, "poacher").total!);
    expect(perMatchUnder(MATCHES, POACHING, STRIKER, "poacher")).toBe((totals[0] + totals[1]) / 2);
    expect(perMatchUnder(MATCHES, POACHING, STRIKER, "poacher")).toBe(perMatchUnder(MATCHES, POACHING, STRIKER, "targetMan")! + 1);
  });

  test("no match to price is a bug, said", () => {
    expect(() => perMatchUnder([], POACHING, STRIKER, "poacher")).toThrow(/No counted match/);
  });
});
