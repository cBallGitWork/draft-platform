import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { scratchRepo } from "../support/scripts/gitRepo.harness.mjs";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";

// The weekly drift pass checks only what merged since the last pass, so it must find that pass
// whatever its title (#1753: #1369's title didn't start `refactor: drift pass`, so the 9 Nov pass
// was missed and the next would have redone 190 merges). And a pass still open, on any branch the
// build gave it, stops a second one starting.

const WORKFLOW = ".github/workflows/drift-pass.yml";
const DOC = "docs/REFACTORING.md";
const read = (path) => readFileSync(join(REPO_ROOT, path), "utf8");
const workflow = read(WORKFLOW);

/** A plain `NAME: "value"` line under the workflow's env. */
function envValue(name) {
  const line = workflow.match(new RegExp(`^  ${name}: "(.+)"`, "m"));
  if (!line) throw new Error(`${WORKFLOW} has no env ${name}`);
  return line[1];
}

/** The workflow's folded `OPEN_PASS: >-` jq filter, its lines joined (jq reads newlines as spaces). */
function openPassFilter() {
  const block = workflow.match(/^ {2}OPEN_PASS: >-\n((?: {4}.*\n)+)/m);
  if (!block) throw new Error(`${WORKFLOW} has no env OPEN_PASS`);
  return block[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

const PASS_MARK = envValue("PASS_MARK");
const PASS_BRANCH = envValue("PASS_BRANCH");

describe("the last drift pass", () => {
  const repo = scratchRepo("drift-pass-");
  afterAll(() => repo.remove());
  const commit = (...paragraphs) =>
    repo.git("commit", "-q", "--allow-empty", ...paragraphs.flatMap((paragraph) => ["-m", paragraph]));
  commit("feat: a feature (#1)");
  commit("refactor: drift pass 29 (#1142)", "Self-review: a..main (40 merges): clean, no changes");
  commit("feat: another feature (#2)");
  // a squash merge: the pull request's title, then each kept commit's message, the record line among them
  commit(
    "refactor: the weekly drift pass: twins kept once (#1369)",
    "* refactor: drift pass: twins kept once",
    "Self-review: 6e6db66f..main (190 merges): 22 findings, 17 fixed, 5 left.",
  );
  commit("fix: names Self-review: mid-line, so it is no pass (#3)");
  commit("feat: merged since the pass (#4)");

  test("is the newest commit carrying the record line, whatever its title", () => {
    const lastPass = repo.git("log", "-1", "--format=%s", `--grep=${PASS_MARK}`).trim();
    expect(lastPass).toBe("refactor: the weekly drift pass: twins kept once (#1369)");
  });

  test("REFACTORING.md's commands find it by the same mark", () => {
    const marks = [...read(DOC).matchAll(/--grep '([^']+)'/g)].map(([, mark]) => mark);
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.filter((mark) => mark !== PASS_MARK)).toEqual([]);
  });
});

describe("an open drift pass", () => {
  const ISSUE = "1368";
  /** The pull requests OPEN_PASS picks from `prs`, run as the workflow runs it. */
  function openPasses(prs, issue = ISSUE) {
    const run = spawnSync("jq", ["-r", "--arg", "branch", PASS_BRANCH, "--arg", "issue", issue, openPassFilter()], {
      input: JSON.stringify(prs),
      encoding: "utf8",
    });
    if (run.status !== 0) throw new Error(`jq: ${run.stderr}`);
    return run.stdout.split("\n").filter(Boolean).map(Number);
  }
  const pr = (number, headRefName, body) => ({ number, headRefName, body });

  test("is one on a drift-pass branch, or one naming the drift-pass issue, whatever its title", () => {
    const prs = [
      pr(1, `${PASS_BRANCH}-30`, "## What\n\nTidy."),
      pr(2, `wip/issue-${ISSUE}-42579725123`, `Unfinished. Part of #${ISSUE}`),
      pr(3, "fix/1400-scouting", `## What\n\nScouting.\n\nCloses #${ISSUE}`),
      pr(4, "fix/1200-trades", "## What\n\nTrades.\n\nCloses #13680"),
      pr(5, "fix/1201-waivers", null),
      pr(6, "refactor/other", "Closes #99"),
    ];
    expect(openPasses(prs)).toEqual([1, 2, 3]);
  });

  test("before the drift-pass issue exists, is only one on a drift-pass branch", () => {
    expect(openPasses([pr(1, `${PASS_BRANCH}-1`, ""), pr(2, "feat/x", "Closes #")], "")).toEqual([1]);
  });
});
