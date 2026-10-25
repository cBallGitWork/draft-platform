import { describe, expect, test } from "vitest";
import { codesByOpta } from "../../../convex/football/feedIds";
import { fplStatLines } from "../../../convex/football/fplLive";
import { mergeStats } from "../../../convex/stats/matchRecords";
import { plStatLines } from "../../../convex/football/plMatch";
import { FULL_STATS, hullEvertonReads, MATCH, recordedGw6, recordedPlFixture } from "../../support/recorded/gw6.payloads";
import { withOwnStats } from "../../../convex/scoring/ownStats";
import { scoreMatch, type MatchStats } from "../../../convex/scoring/scoring";
import { centreOf, TACKLES_AND_CLEARANCES } from "../../support/convex/scoring.example";
import { validateScoringSet, type OwnStat, type ScoringSet } from "../../../convex/scoring/scoringSet";
import { STAT_CATALOGUE } from "../../../convex/scoring/statCatalogue";

// A league's own stats (#112, spec/14 Own stats): catalogue stats added up with weights, scored
// like any category, whole actions only under whole points only; and the placeholder catalogue.

const gw6 = recordedGw6();
const plLines = plStatLines(recordedPlFixture(MATCH.hullEverton.pl), hullEvertonReads(gw6), codesByOpta(gw6.fpl.bootstrap.elements)).lines;
const fplLines = fplStatLines(gw6.fpl.live, gw6.fpl.bootstrap.elements, gw6.fpl.fixtures);
/** Hull's right back: one tackle won and one clearance, by the Premier League's count. */
const coyle: MatchStats = {
  ...fplLines.find((line) => line.playerCode === FULL_STATS.coyle.code)!.stats,
  ...plLines.find((line) => line.playerCode === FULL_STATS.coyle.code)!.stats,
};

const setWith = (ownStats: OwnStat[], wholePointsOnly = false): ScoringSet => ({
  rules: [{ shape: "perAction", stat: TACKLES_AND_CLEARANCES.stat, values: { all: 1 } }],
  wholePointsOnly,
  ownStats,
});

describe("#112 Done: tackles + 0.5 × clearances", () => {
  test("scores the recorded right back's match: one of each makes 1.5", () => {
    expect(coyle).toMatchObject({ won_tackle: 1, total_clearance: 1 });
    expect(scoreMatch(coyle, setWith([TACKLES_AND_CLEARANCES]), centreOf("defence"))).toEqual({
      total: 1.5,
      categories: [{ stat: TACKLES_AND_CLEARANCES.stat, points: 1.5 }],
    });
  });

  test("rounds down to whole actions under whole points only: 1.5 counts 1", () => {
    expect(scoreMatch(coyle, setWith([TACKLES_AND_CLEARANCES], true), centreOf("defence")).total).toBe(1);
  });
});

test("a negative weight takes away: shots − shots on target is shots off target", () => {
  const offTarget: OwnStat = {
    stat: "own_off_target",
    name: "Off target",
    shortCode: "OFF",
    parts: [
      { stat: "total_scoring_att", weight: 1 },
      { stat: "ontarget_scoring_att", weight: -1 },
    ],
  };
  expect(withOwnStats({ total_scoring_att: 5, ontarget_scoring_att: 2 }, setWith([offTarget]))).toMatchObject({ own_off_target: 3 });
});

test("under whole points only, a negative own stat rounds down too: -0.5 counts -1", () => {
  const lostBall: OwnStat = { stat: "own_lost", name: "Lost", shortCode: "LOST", parts: [{ stat: "dispossessed", weight: -0.5 }] };
  expect(withOwnStats({ dispossessed: 1 }, setWith([lostBall], true))).toMatchObject({ own_lost: -1 });
});

test("weights of tenths that add to a whole count the whole, never one under it", () => {
  const tenth: OwnStat = { stat: "own_tenth", name: "Tenth", shortCode: "TEN", parts: [{ stat: "touches", weight: 0.1 }] };
  expect(withOwnStats({ touches: 30 }, setWith([tenth], true))).toMatchObject({ own_tenth: 3 });
});

describe("refused, with the reason", () => {
  const own = (change: Partial<OwnStat>): OwnStat => ({ ...TACKLES_AND_CLEARANCES, ...change });
  test.each([
    ["built from another own stat", [TACKLES_AND_CLEARANCES, own({ stat: "own_more", name: "More", shortCode: "M", parts: [{ stat: TACKLES_AND_CLEARANCES.stat, weight: 1 }] })], "the own stat own_more adds \"own_tackles_and_clearances\", which isn't a catalogue stat"],
    ["built from a stat not in the catalogue", [own({ parts: [{ stat: "made_up", weight: 1 }] })], "adds \"made_up\", which isn't a catalogue stat"],
    ["with a catalogue stat's key", [own({ stat: "won_tackle" })], "the own stat won_tackle has a catalogue stat's key"],
    ["made twice", [TACKLES_AND_CLEARANCES, TACKLES_AND_CLEARANCES], "the own stat own_tackles_and_clearances is made twice"],
    ["two with one short code", [TACKLES_AND_CLEARANCES, own({ stat: "own_other", name: "Other" })], 'has the short code "T+C", which another own stat has'],
    ["adding up nothing", [own({ parts: [] })], "adds up no stats"],
    ["a weight of text", [own({ parts: [{ stat: "won_tackle", weight: "1" as unknown as number }] })], 'weighs won_tackle at "1", not a number'],
    ["no name", [own({ name: " " })], "has no name"],
  ])("%s", (_what, ownStats, reason) => {
    expect(() => validateScoringSet(setWith(ownStats))).toThrow(reason);
  });
});

test("an own stat named as a catalogue stat now is, saved before, still scores: only a save refuses it (#212)", () => {
  const clash = { ...TACKLES_AND_CLEARANCES, name: "Won tackle", shortCode: "WT" };
  expect(scoreMatch(coyle, setWith([clash]), centreOf("defence")).total).toBe(1.5);
});

test("a refusal names an own stat's rule by its own name, as the rules editor shows it", () => {
  const fractional = { ...setWith([TACKLES_AND_CLEARANCES], true), rules: [{ shape: "perAction" as const, stat: TACKLES_AND_CLEARANCES.stat, values: { all: 0.5 } }] };
  expect(() => validateScoringSet(fractional)).toThrow("the Tackles and clearances rule pays 0.5, but the set counts whole points only");
});

describe("the catalogue, placeholders for now (spec/14)", () => {
  test("every stat has a name and a short code, and no two share a key or a code", () => {
    const keys = STAT_CATALOGUE.map((entry) => entry.stat);
    const codes = STAT_CATALOGUE.map((entry) => entry.shortCode);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(codes).size).toBe(codes.length);
    expect(STAT_CATALOGUE.every((entry) => entry.name.trim() && entry.shortCode.trim())).toBe(true);
  });

  test("it holds every stat the recorded match's merged records hold, and never FPL's points", () => {
    const keys = new Set(STAT_CATALOGUE.map((entry) => entry.stat));
    const players = new Set([...fplLines, ...plLines].filter((line) => line.fixtureCode === MATCH.hullEverton.code).map((line) => line.playerCode));
    expect(players.size).toBe(40);
    const held = new Set<string>();
    for (const player of players) {
      const stats = (lines: typeof plLines) => lines.find((line) => line.playerCode === player && line.fixtureCode === MATCH.hullEverton.code)?.stats;
      for (const stat of Object.keys(mergeStats(stats(fplLines), stats(plLines)))) held.add(stat);
    }
    // Where he lined up, and whether he played, are about the match, not stats to score.
    for (const notAStat of ["formation_place", "played"]) held.delete(notAStat);
    expect([...held].filter((stat) => !keys.has(stat))).toEqual([]);
    for (const points of ["bonus", "bps", "total_points", "in_dreamteam"]) expect(keys).not.toContain(points);
  });
});
