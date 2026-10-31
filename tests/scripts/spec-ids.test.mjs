import { execFileSync } from "node:child_process";
import { expect, test } from "vitest";
import { checkIds } from "../../scripts/spec-ids.mjs";
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

test("the repo's own spec and tests pass", () => {
  const output = execFileSync(process.execPath, ["scripts/spec-ids.mjs"], { cwd: REPO_ROOT, encoding: "utf8" });
  expect(output).toMatch(/^spec IDs: \d+ answers have IDs; uncited by any test: /);
});
