import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";

// The lint step (#154) gates only while two things hold: `npm run verify` runs it, and any warning
// fails it. Dropping one stays green everywhere else, so this file checks each. And a check that
// `npm run verify` alone runs passes locally but never gates a merge, so every check it runs past
// the tests is a step of CI's verify workflow too (#1580).

const LINT_RUN = "npm run lint";
const NO_WARNINGS = "--max-warnings 0";
/** What CI's verify workflow runs, a step to a `- run:` line. */
const CI_WORKFLOW = ".github/workflows/verify.yml";
/** verify's own steps that CI runs another way: the install check (CI installs with `npm ci`) and
 *  the tests (sharded in their own job). */
const NOT_A_CI_STEP = [/^npm ls /, /^\{ echo /, /^npm test$/];

const read = (path) => readFileSync(join(REPO_ROOT, path), "utf8");
const { scripts } = JSON.parse(read("package.json"));
const verifySteps = scripts.verify.split(/ && | \|\| /);

test("npm run verify runs the lint step", () => {
  expect(verifySteps).toContain(LINT_RUN);
});

test("CI's verify workflow runs every check npm run verify runs", () => {
  const ciSteps = [...read(CI_WORKFLOW).matchAll(/^\s*- run: (.+)$/gm)].map(([, step]) => step.trim());
  const checks = verifySteps.filter((step) => !NOT_A_CI_STEP.some((skip) => skip.test(step)));
  expect(checks.length).toBeGreaterThan(0);
  expect(checks.filter((check) => !ciSteps.includes(check))).toEqual([]);
});

test("the lint step fails on any warning", () => {
  expect(scripts.lint).toContain(NO_WARNINGS);
});
