import { execFileSync } from "node:child_process";
import { expect, test } from "vitest";
import { MAX_LINES, NEAR_TOP, docsWithoutContents } from "../../scripts/contents-lists.mjs";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";

/** A doc of `count` lines, with `line` at line `at` (1-based) when given. */
function doc(count, line, at = 3) {
  const lines = Array.from({ length: count }, (_, index) => `line ${index + 1}`);
  if (line !== undefined) lines[at - 1] = line;
  return lines.join("\n") + "\n";
}

test("a long doc with no contents list is named", () => {
  expect(docsWithoutContents([["docs/long.md", doc(MAX_LINES + 1)]])).toEqual(["docs/long.md"]);
});

test("a doc of exactly the limit needs none", () => {
  expect(docsWithoutContents([["docs/short.md", doc(MAX_LINES)]])).toEqual([]);
});

test("a **Contents:** line or a ## Contents heading near the top passes", () => {
  expect(
    docsWithoutContents([
      ["a.md", doc(MAX_LINES + 1, "**Contents:** [One](#one) · [Two](#two)")],
      ["b.md", doc(MAX_LINES + 1, "## Contents", NEAR_TOP)],
    ]),
  ).toEqual([]);
});

test("a contents list below the top, or the word in passing, doesn't count", () => {
  expect(
    docsWithoutContents([
      ["late.md", doc(MAX_LINES + 1, "**Contents:** [One](#one)", NEAR_TOP + 1)],
      ["prose.md", doc(MAX_LINES + 1, "The table of contents is below.")],
    ]),
  ).toEqual(["late.md", "prose.md"]);
});

test("a generated doc is skipped", () => {
  expect(docsWithoutContents([["convex/_generated/ai/guidelines.md", doc(MAX_LINES + 1)]])).toEqual([]);
});

test("the repo's own docs pass", () => {
  const output = execFileSync(process.execPath, ["scripts/contents-lists.mjs"], { cwd: REPO_ROOT, encoding: "utf8" });
  expect(output).toMatch(/^contents lists: every doc over \d+ lines has one/);
});
