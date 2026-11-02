import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";

// The lint step (#154) gates only while two things hold: `npm run verify` runs it, and any warning
// fails it. Dropping one stays green everywhere else, so this file checks each.

const LINT_RUN = "npm run lint";
const NO_WARNINGS = "--max-warnings 0";

const read = (path) => readFileSync(join(REPO_ROOT, path), "utf8");
const { scripts } = JSON.parse(read("package.json"));

test("npm run verify runs the lint step", () => {
  expect(scripts.verify.split(" && ")).toContain(LINT_RUN);
});

test("the lint step fails on any warning", () => {
  expect(scripts.lint).toContain(NO_WARNINGS);
});
