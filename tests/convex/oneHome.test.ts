import { expect, test } from "vitest";
import { at, copiesIn, repoPath, restatedIn, type Sources } from "../support/convex/oneHome.harness";

// One home for each type, helper and fixture (#1813), beside featureImports.test.ts. Each pull
// request is reviewed on its own diff, so a type written out again in a new file goes past it, and
// when one copy changes the others drift. It fails when:
// - the same type alias, function body of 3 or more lines, or object holding only literals is
//   written in 3 or more files under convex/: three is docs/PHILOSOPHY.md's "same pattern 3 times".
//   An alias that only picks from another type (`Foo["k"][number]`, `Extract<…>`) is left out;
// - a test declares a top-level name a tests/support/ harness exports with the same value (a name
//   alone is not enough), unless the test reads it only as an expected value, restated on purpose.
// The copies found when it was added sit in STILL_DUPLICATED and STILL_RESTATED, which only
// shrink; ALLOWED holds the ones kept on purpose, each with its reason. What it reads with is in
// tests/support/convex/oneHome.harness.ts.

const CONVEX = import.meta.glob<string>(["../../convex/**/*.ts", "!../../convex/_generated/**", "!../../convex/**/*.d.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
});
const TESTS = import.meta.glob<string>("../**/*.test.{ts,tsx}", { query: "?raw", import: "default", eager: true });
const HARNESSES = import.meta.glob<string>("../support/**/*.harness.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** Copies kept on purpose: the copy's name and why. */
const ALLOWED: Record<string, string> = {
  "{ cursor: null }": "the first page of Convex's paginate, an argument written where it is passed, not a value to name",
};

/** The copies in convex/ when this test was added (12 Nov 2026), each one's name to its files. Each
 *  goes when its copies move to one home: never add to it. */
const STILL_DUPLICATED: Record<string, string[]> = {
  'type TeamId = Id<"teams">': [
    "convex/gameweekScorer/gameweekScores.ts",
    "convex/gameweekScorer/storedScores.ts",
    "convex/gameweekScorer/teamGameweek.ts",
    "convex/home/recaps.ts",
    "convex/matchup/matchup.ts",
    "convex/matchup/readCommentary.ts",
    "convex/stats/teamSeasonStats.ts",
    "convex/table/fixtureEdits.ts",
    "convex/table/pointsOverrides.ts",
    "convex/table/sentTables.ts",
  ],
};
/** The tests restating a harness's export when this test was added, as "test name -> harness".
 *  Each goes when its test imports the export: never add to it. */
const STILL_RESTATED: string[] = [
  "tests/convex/football/matchScores.test.ts SPURS -> tests/support/src/premierLeague.harness.ts",
  "tests/convex/football/sportmonks/sportmonksPositionsSync.test.ts TOKEN -> tests/support/convex/sportmonks.harness.ts",
  "tests/convex/gameweeks/postponedGameweek.test.ts NEXT -> tests/support/convex/lineupSquad.harness.ts",
  "tests/convex/lineup/lineup.test.ts KEEPER -> tests/support/convex/autoSubs.harness.ts",
  "tests/convex/lineup/lineup.test.ts LEFT_BACK -> tests/support/convex/autoSubs.harness.ts",
  "tests/convex/lineup/lineup.test.ts LEFT_MIDFIELDER -> tests/support/convex/autoSubs.harness.ts",
  "tests/convex/lineup/lineup.test.ts OTHER_STRIKER -> tests/support/convex/autoSubs.harness.ts",
  "tests/convex/lineup/lineup.test.ts STRIKER -> tests/support/convex/autoSubs.harness.ts",
  "tests/convex/scoring/ownStats.test.ts fplLines -> tests/support/convex/teamPoints.harness.ts",
  "tests/convex/scoring/redrawnRolesVersion.test.ts NEXT -> tests/support/convex/lineupSquad.harness.ts",
  "tests/convex/scouting/scoutingPlayers.test.ts KICKOFF -> tests/support/convex/matchStats.harness.ts",
  "tests/convex/stars/deadlineStars.test.ts NEXT -> tests/support/convex/lineupSquad.harness.ts",
  "tests/convex/stats/matchRecordsCap.test.ts MADE_UP_CODES -> tests/support/convex/test.harness.ts",
  "tests/convex/table/playedFixtures.test.ts recordPassed -> tests/support/convex/deadlineRecorder.harness.ts",
  "tests/convex/table/playedFixtures.test.ts setUsedIn -> tests/support/convex/deadlineRecorder.harness.ts",
  "tests/src/matchup/teamOverride.test.tsx GAMEWEEK -> tests/support/convex/matchStats.harness.ts",
  "tests/src/myTeam/transactions.test.tsx SAKA -> tests/support/convex/lineupSquad.harness.ts",
  "tests/src/myTeam/transactions.test.tsx cells -> tests/support/src/squadTab.harness.ts",
  "tests/src/scoring/scoringControls.test.tsx saveButton -> tests/support/src/leagueSettingsScreen.harness.ts",
  "tests/src/trades/offerSides.test.ts DEADLINE -> tests/support/src/trades.harness.ts",
];

/** What differs from the lists: each new or grown copy with every file and line, and each list
 *  entry whose copies have gone, so the lists shrink with them. */
function problems(convex: Sources = CONVEX, tests: Sources = TESTS, harnesses: Sources = HARNESSES): string[] {
  const found = copiesIn(convex, ALLOWED);
  const out: string[] = [];
  for (const { name, places } of found) {
    const files = [...new Set(places.map(({ file }) => file))].sort();
    if (JSON.stringify(files) !== JSON.stringify(STILL_DUPLICATED[name]))
      out.push(`${name} is written in ${files.length} files: ${places.map(at).join(", ")}; give it one home`);
  }
  for (const name of Object.keys(STILL_DUPLICATED))
    if (!found.some((copies) => copies.name === name)) out.push(`${name} has one home now: take it off STILL_DUPLICATED`);
  const restated = restatedIn(tests, harnesses);
  for (const { name, place } of restated) {
    const [test, harness] = name.split(" -> ");
    if (!STILL_RESTATED.includes(name)) out.push(`${at(place)} restates ${harness}'s export ${test.split(" ")[1]}: import it`);
  }
  for (const name of STILL_RESTATED)
    if (!restated.some((one) => one.name === name)) out.push(`${name} is no longer restated: take it off STILL_RESTATED`);
  return out;
}

test("no type, helper or fixture is written out again but those still to move", () => {
  expect(problems()).toEqual([]);
});

test("reads every file it is there to check", () => {
  expect(Object.keys(CONVEX).length).toBeGreaterThan(100);
  expect(Object.keys(CONVEX).some((key) => key.includes("_generated"))).toBe(false);
  expect(Object.keys(TESTS).length).toBeGreaterThan(100);
  expect(Object.keys(HARNESSES).length).toBeGreaterThan(30);
  expect(repoPath("./lineup/lineup.test.ts")).toBe("tests/convex/lineup/lineup.test.ts");
  expect(repoPath("../src/trades/offerSides.test.ts")).toBe("tests/src/trades/offerSides.test.ts");
  expect(repoPath("../support/convex/autoSubs.harness.ts")).toBe("tests/support/convex/autoSubs.harness.ts");
  expect(repoPath("../../convex/table/sentTables.ts")).toBe("convex/table/sentTables.ts");
});

test("a third copy of an alias and a harness's export restated in a test both fail", () => {
  const convex = {
    "../../convex/a/one.ts": 'type PlayerCode = number;\ntype Pick = Foo["k"][number];',
    "../../convex/b/two.ts": 'type PlayerCode = number;\ntype Pick = Foo["k"][number];',
    "../../convex/c/three.ts": 'export type PlayerCode = number;\ntype Pick = Foo["k"][number];',
  };
  const harnesses = {
    "../support/convex/clubs.harness.ts": 'export const ARSENAL = { code: 3, name: "Arsenal" };\nexport const GAMEWEEK = 6;',
  };
  const tests = {
    // A copy of the harness's ARSENAL; a CHELSEA it doesn't have; a GAMEWEEK of another value.
    "./clubs.test.ts": ['const ARSENAL = { code: 3, name: "Arsenal" };', 'const CHELSEA = { code: 8, name: "Chelsea" };', "const GAMEWEEK = 7;"].join("\n"),
    // ARSENAL restated on purpose, read only as the expected value.
    "./expected.test.ts": 'const ARSENAL = { code: 3, name: "Arsenal" };\nexpect(read()).not.toEqual(ARSENAL);',
  };
  expect(problems(convex, tests, harnesses)).toEqual([
    "type PlayerCode = number is written in 3 files: convex/a/one.ts:1, convex/b/two.ts:1, convex/c/three.ts:1; give it one home",
    ...Object.keys(STILL_DUPLICATED).map((name) => `${name} has one home now: take it off STILL_DUPLICATED`),
    "tests/convex/clubs.test.ts:1 restates tests/support/convex/clubs.harness.ts's export ARSENAL: import it",
    ...STILL_RESTATED.map((name) => `${name} is no longer restated: take it off STILL_RESTATED`),
  ]);
});

test("a fourth file holding a copy still to move fails, so the list can't grow", () => {
  const convex = { ...CONVEX, "../../convex/table/another.ts": 'type TeamId = Id<"teams">;' };
  expect(problems(convex)).toEqual([
    expect.stringMatching(/^type TeamId = Id<"teams"> is written in 11 files: .*convex\/table\/another\.ts:1.*; give it one home$/),
  ]);
});

test("a copy counts only from three files, and a function body only from three lines", () => {
  const convex = {
    "../../convex/a/one.ts": "const a = () => { return 1; };\nconst b = { x: 1, y: 2 };",
    "../../convex/b/two.ts": "const a = () => { return 1; };\nconst b = { x: 1, y: 2 };",
    "../../convex/c/three.ts": "const a = () => { return 1; };\nfunction c() {\n  return 2;\n}",
    "../../convex/d/four.ts": "function c() {\n  return 2;\n}",
    "../../convex/e/five.ts": "const d = () => {\n  return 2;\n};",
  };
  expect(copiesIn(convex).map(({ name, places }) => [name, places.map(at)])).toEqual([
    ["{ return 2; }", ["convex/c/three.ts:2", "convex/d/four.ts:1", "convex/e/five.ts:1"]],
  ]);
});
