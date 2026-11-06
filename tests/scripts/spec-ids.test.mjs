import { expect, test } from "vitest";
import { checkBranch, checkIds, repoFiles } from "../../scripts/spec-ids.mjs";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";

// Made-up spec files and tests; the real run skips this file, so these IDs are never citations.
const SPEC = [
  "01-leagues.md",
  ["- An answer. `S01.1`", "- Another, over", "  two lines. `S01.2`", "- A dropped one. `S01.3 withdrawn`", "**A table** (`S01.1`):"].join("\n"),
];

test("an answer each test cites passes, and the rest are listed as uncited", () => {
  expect(checkIds([SPEC], [["tests/a.test.ts", "// S01.1"]])).toEqual({ answers: 3, problems: [], uncited: ["S01.2"] });
});

test("an ID given twice, or in the wrong spec file, fails", () => {
  const twice = ["02-sign-in.md", "- Again. `S01.1`\n- Its own. `S02.1`"];
  expect(checkIds([SPEC, twice], []).problems).toEqual([
    "S01.1 is given twice: in 01-leagues.md and 02-sign-in.md",
    "S01.1 is given in 02-sign-in.md, but its number says spec/01",
  ]);
});

test("a test or a caption mentioning an ID no answer has, or one withdrawn, fails", () => {
  const caption = ["03-league-rules.md", "**A table** (`S03.9`):"];
  expect(checkIds([SPEC, caption], [["tests/a.test.ts", "test('S01.3 and S01.4')"]]).problems).toEqual([
    "03-league-rules.md mentions S03.9, which no answer in spec/ has",
    "tests/a.test.ts mentions S01.3, which is withdrawn",
    "tests/a.test.ts mentions S01.4, which no answer in spec/ has",
  ]);
});

// The IDs only: the comparison with origin/main needs its history, which the unit job's shallow
// checkout lacks; verify's checks job runs the whole script.
test("the repo's own spec and tests pass", () => {
  const { specs, tests } = repoFiles(REPO_ROOT);
  const { answers, problems } = checkIds(specs, tests);
  expect(problems).toEqual([]);
  expect(answers).toBeGreaterThan(0);
});

// The branch against origin/main (Craig, 6 Nov 2026, on #454).
const OLD = ["02-sign-in.md", "- An old answer, never given an ID."];
const MAIN = { specs: [SPEC, OLD], tests: [["tests/a.test.ts", ""]] };

test("a branch that leaves the answers alone, or only rewraps an old one, passes with nothing listed", () => {
  const rewrapped = ["02-sign-in.md", "Intro.\n\n- An old answer,\n  never given an ID."];
  expect(checkBranch(MAIN, { specs: [SPEC, rewrapped], tests: [["tests/a.test.ts", "// S01.1"]] })).toEqual({
    problems: [],
    changed: [],
    newUncited: [],
  });
});

test("a new answer, or an old one reworded, with no ID fails; with an ID it passes", () => {
  const added = ["02-sign-in.md", "- An old answer, now reworded.\n- A new one. `S02.1`\n- Another new one."];
  expect(checkBranch(MAIN, { specs: [SPEC, added], tests: [] }).problems).toEqual([
    '02-sign-in.md has a new or reworded answer with no ID: "An old answer, now reworded.…"',
    '02-sign-in.md has a new or reworded answer with no ID: "Another new one.…"',
  ]);
});

test("an ID origin/main has that the branch drops fails; marking it withdrawn is a change, listed", () => {
  const [file, text] = SPEC;
  const dropped = [file, text.replace("- A dropped one. `S01.3 withdrawn`", "")];
  expect(checkBranch(MAIN, { specs: [dropped, OLD], tests: [] }).problems).toEqual([
    "S01.3 is on origin/main but gone here: keep its answer, marked `S01.3 withdrawn`",
  ]);
  const withdrawn = [file, text.replace("`S01.2`", "`S01.2 withdrawn`")];
  expect(checkBranch(MAIN, { specs: [withdrawn, OLD], tests: [] }).changed).toEqual([{ id: "S01.2", tests: [] }]);
});

test("the tests citing a changed answer are listed, never failed, as are new test files citing none", () => {
  const [file, text] = SPEC;
  const changed = [file, text.replace("- An answer.", "- An answer, changed.")];
  const tests = [
    ["tests/a.test.ts", "// S01.1"],
    ["tests/b.test.ts", "test('S01.1 again')"],
    ["tests/c.test.ts", "test('cites nothing')"],
    ["tests/support/helper.ts", "// a helper, not a check"],
  ];
  expect(checkBranch(MAIN, { specs: [changed, OLD], tests })).toEqual({
    problems: [],
    changed: [{ id: "S01.1", tests: ["tests/a.test.ts", "tests/b.test.ts"] }],
    newUncited: ["tests/c.test.ts"],
  });
});
