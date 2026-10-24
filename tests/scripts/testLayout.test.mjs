import { readdirSync } from "node:fs";
import { join, matchesGlob, relative, sep } from "node:path";
import { expect, test } from "vitest";
import config from "../../vitest.config.ts";

// A test file no Vitest project's include matches never runs, and nothing says so. This walks
// tests/ and names any such file, using the include globs vitest.config.ts itself holds.

const REPO_ROOT = join(import.meta.dirname, "../..");
const TESTS_ROOT = "tests";
// Playwright runs tests/smoke/ (`npm run smoke`); tests/support/ holds harnesses, not tests.
const NOT_VITEST = [`${TESTS_ROOT}/smoke/`, `${TESTS_ROOT}/support/`];
const TEST_FILE = /\.(test|spec)\.[^/]+$/;

const projectIncludes = config.test.projects.flatMap((project) => project.test.include);

// Vitest's globs use "/" on every platform.
const withForwardSlashes = (path) => path.split(sep).join("/");

function testFilesUnderTests() {
  return readdirSync(join(REPO_ROOT, TESTS_ROOT), { recursive: true })
    .map((path) => withForwardSlashes(join(TESTS_ROOT, path)))
    .filter((path) => TEST_FILE.test(path) && !NOT_VITEST.some((dir) => path.startsWith(dir)));
}

function unrunTestFiles(files, includes) {
  return files.filter((file) => !includes.some((glob) => matchesGlob(file, glob)));
}

test("every test file under tests/ is picked up by a Vitest project", () => {
  const files = testFilesUnderTests();
  expect(files.length).toBeGreaterThan(0);
  expect(unrunTestFiles(files, projectIncludes)).toEqual([]);
});

test("a test file no project includes is named, and one a project includes is not", () => {
  const strays = ["tests/convex/x.test.tsx", "tests/src/x.spec.ts", "tests/elsewhere/x.test.ts"];
  const runs = ["tests/convex/x.test.ts", "tests/src/deep/x.test.tsx", "tests/scripts/x.test.mjs"];
  expect(unrunTestFiles([...strays, ...runs], projectIncludes)).toEqual(strays);
});

test("the walk finds this file, so a stray beside it would be found too", () => {
  const thisFile = withForwardSlashes(relative(REPO_ROOT, import.meta.filename));
  expect(testFilesUnderTests()).toContain(thisFile);
});
