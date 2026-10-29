import { expect, test } from "vitest";
import { mapFpl } from "../../../convex/football/fpl/fpl";
import type { RawPlFixture } from "../../../convex/football/premierLeague/premierLeague";
import { fplScoreRead, plScoreRead, readEach } from "../../../convex/football/scoreReads";
import { FIXTURE_CODE, recordedFpl } from "../../support/recorded/fpl.payloads";
import { FPL_RECORDED_LIVE, IPSWICH_FOREST, recordedLiveScore } from "../../support/recorded/scores.payloads";

// How each feed's read becomes a match's score and clock (#49): FPL's fixtures, recorded with a
// match finished, one live and one upcoming, and the Premier League's reads of Ipswich v Nott'm
// Forest, recorded live from before kickoff to full time.

const LIVE_MATCH = FPL_RECORDED_LIVE;
const UPCOMING_MATCH = IPSWICH_FOREST;

const noScore = { homeGoals: null, awayGoals: null, minutes: null, clockLabel: null };

test("FPL's finished, live and upcoming matches give their scores and minutes", () => {
  const { bootstrap, fixtures } = recordedFpl();

  expect(mapFpl(bootstrap, fixtures).scores).toEqual({
    reads: [
      { fixtureCode: FIXTURE_CODE.arsenalVCoventry, state: "fullTime", homeGoals: 3, awayGoals: 0, minutes: 90, clockLabel: null },
      { fixtureCode: LIVE_MATCH, state: "live", homeGoals: 2, awayGoals: 1, minutes: 72, clockLabel: null },
      { fixtureCode: UPCOMING_MATCH, state: "upcoming", ...noScore },
    ],
    problems: [],
  });
});

test.each([
  ["beforeKickoff", { state: "upcoming", ...noScore }],
  ["firstGoal", { state: "live", homeGoals: 0, awayGoals: 1, minutes: 13, clockLabel: "13'00" }],
  ["halfTime", { state: "halfTime", homeGoals: 1, awayGoals: 1, minutes: 48, clockLabel: "45+3'00" }],
  ["secondHalf", { state: "live", homeGoals: 1, awayGoals: 1, minutes: 45, clockLabel: "45'00" }],
  ["fullTime", { state: "fullTime", homeGoals: 1, awayGoals: 1, minutes: 99, clockLabel: "90+9'00" }],
] as const)("the Premier League's read %s gives its state, score and clock", (stage, expected) => {
  const { fixture } = recordedLiveScore(stage);

  expect(plScoreRead(fixture, IPSWICH_FOREST)).toEqual({ fixtureCode: IPSWICH_FOREST, ...expected });
});

test("a finished match FPL sends no score for is a problem, and the other matches are still read", () => {
  const { bootstrap, fixtures } = recordedFpl();
  fixtures.find((fixture) => fixture.code === FIXTURE_CODE.arsenalVCoventry)!.team_h_score = null;

  const { reads, problems } = mapFpl(bootstrap, fixtures).scores;

  expect(problems).toEqual([{ fixtureCode: FIXTURE_CODE.arsenalVCoventry, problem: "FPL sent score null for a match at fullTime" }]);
  expect(reads.map((read) => read.fixtureCode)).toEqual([LIVE_MATCH, UPCOMING_MATCH]);
});

test("a match FPL sends no started flag for is a problem; a postponed one, with no kickoff, is upcoming", () => {
  const { fixtures } = recordedFpl();
  const [finished, live] = fixtures;
  delete finished.started;
  const postponed = { ...live, started: null, kickoff_time: null };

  expect(readEach([finished, postponed], (fixture) => fixture.code, fplScoreRead)).toEqual({
    reads: [{ fixtureCode: LIVE_MATCH, state: "upcoming", ...noScore }],
    problems: [{ fixtureCode: FIXTURE_CODE.arsenalVCoventry, problem: "FPL sent started undefined" }],
  });
});

test.each([
  [
    "a status it has not been seen to send",
    (fixture: RawPlFixture): void => {
      fixture.status = "P";
    },
    'the Premier League sent status "P"',
  ],
  [
    "no score for a side",
    (fixture: RawPlFixture): void => {
      delete fixture.teams![1].score;
    },
    "the Premier League sent score undefined for a match at live",
  ],
  [
    "no clock",
    (fixture: RawPlFixture): void => {
      delete fixture.clock;
    },
    "the Premier League sent clock secs undefined",
  ],
] as const)("a live match the Premier League sends %s for is a problem", (_what, change, problem) => {
  const { fixture } = recordedLiveScore("firstGoal");
  change(fixture);

  expect(() => plScoreRead(fixture, IPSWICH_FOREST)).toThrow(problem);
});
