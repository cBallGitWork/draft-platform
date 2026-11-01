// scripts/tests-kept.mjs, the never-cut-tests check that `npm run verify` runs: which calls it
// reads as tests and how it names them; which it counts as removed; which trailers let a removal
// through; and, in a scratch repo whose origin/main holds two test files, the check end to end,
// committed or not.

import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { TRAILER_PLACE } from "../../scripts/branchCheck.mjs";
import { NAME_JOIN, removedTests, testNames, unexcused } from "../../scripts/tests-kept.mjs";
import { scratchRepo } from "../support/scripts/gitRepo.harness.mjs";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";

const SCRIPT = join(REPO_ROOT, "scripts/tests-kept.mjs");

const named = (...titles) => titles.join(NAME_JOIN);

describe("testNames", () => {
  test("names test() and it() calls by the describe() titles around them, nested", () => {
    const text = `
      describe("outer", () => {
        test("one", () => {});
        describe("inner", () => { it("two", async () => {}); });
      });
      test("top", function () {});`;
    expect(testNames("a.test.ts", text)).toEqual([named("outer", "one"), named("outer", "inner", "two"), "top"]);
  });

  test("reads .only, .skip, .todo, .each and .skipIf, and Playwright's test.describe", () => {
    const text = `
      test.describe("pw", () => { test("in pw", async ({ page }) => {}); });
      test.only("only", () => {});
      it.skip("skipped", () => {});
      test.todo("later");
      test.each([1, 2])("row %i", (n) => {});
      describe.each(["a"])("suite %s", () => { test("inside", () => {}); });
      test.skipIf(true)("if", () => {});`;
    expect(testNames("a.spec.ts", text)).toEqual([
      named("pw", "in pw"), "only", "skipped", "later", "row %i", named("suite %s", "inside"), "if",
    ]);
  });

  test("a template title is named by its code; a string's by its text", () => {
    const text = "test(`at ${width} wide`, () => {}); test(`plain`, () => {}); test(TITLE, () => {});";
    expect(testNames("a.test.ts", text)).toEqual(["`at ${width} wide`", "plain", "TITLE"]);
  });

  test("hooks, steps, a bodiless skip inside a test, and the word test in a string declare nothing", () => {
    const text = `
      test.beforeEach(() => {});
      beforeAll(() => {});
      test("real", async () => {
        test.skip(isMobile, "no phone");
        await test.step("a step", async () => {});
      });
      const fixture = 'test("not a test", () => {})';
      other("not either", () => {});`;
    expect(testNames("a.test.tsx", text)).toEqual(["real"]);
  });
});

describe("removedTests", () => {
  const BEFORE = [["tests/a.test.ts", 'describe("s", () => { test("x", () => {}); test("y", () => {}); });']];

  test("a test moved to another file, or its file renamed, isn't removed", () => {
    const after = [
      ["tests/a.test.ts", 'describe("s", () => { test("x", () => {}); });'],
      ["tests/b.test.ts", 'describe("s", () => { test("y", () => {}); });'],
    ];
    expect(removedTests(BEFORE, after)).toEqual([]);
    expect(removedTests(BEFORE, [["tests/renamed.test.ts", BEFORE[0][1]]])).toEqual([]);
  });

  test("a deleted, renamed or re-suited test is removed, named with the file it was in", () => {
    const after = [["tests/a.test.ts", 'describe("s", () => { test("x2", () => {}); }); test("y", () => {});']];
    expect(removedTests(BEFORE, after)).toEqual([
      { name: named("s", "x"), fewer: 1, files: ["tests/a.test.ts"] },
      { name: named("s", "y"), fewer: 1, files: ["tests/a.test.ts"] },
    ]);
  });

  test("a deleted test file removes every test in it", () => {
    expect(removedTests(BEFORE, []).map(({ name }) => name)).toEqual([named("s", "x"), named("s", "y")]);
  });

  test("two tests of one name count as two, so cutting one is a removal", () => {
    const twice = [["tests/a.test.ts", 'test("x", () => {}); test("x", () => {});']];
    const once = [["tests/a.test.ts", 'test("x", () => {});']];
    expect(removedTests(twice, once)).toEqual([{ name: "x", fewer: 1, files: ["tests/a.test.ts"] }]);
  });
});

describe("unexcused", () => {
  const REMOVED = [{ name: named("s", "x"), fewer: 1, files: ["tests/a.test.ts"] }];

  test("a trailer naming the test, with a reason, lets it through", () => {
    expect(unexcused(REMOVED, [`${named("s", "x")}: the rule went (#9)`])).toEqual([]);
  });

  test("a trailer naming a file it was in, with a reason, lets it through", () => {
    expect(unexcused(REMOVED, ["tests/a.test.ts: the feature went"])).toEqual([]);
  });

  test("no reason, another test, or a name that only starts the same, doesn't", () => {
    for (const value of [`${named("s", "x")}:`, `${named("s", "x")}:   `, `${named("s", "y")}: why`, "s: why"]) {
      expect(unexcused(REMOVED, [value])).toEqual(REMOVED);
    }
  });
});

describe("the check in a repo", () => {
  const FILE_A = "tests/a.test.ts";
  const FILE_B = "tests/b.test.ts";
  let repo;

  const check = () => repo.run(SCRIPT);

  const passes = () => expect(check()).toEqual({ status: 0, said: "" });

  /** The check fails, listing `name` among the tests it refused; what it said. */
  function refuses(name) {
    const { status, said } = check();
    expect(status).toBe(1);
    expect(said).toContain(`  ${name}, in`);
    return said;
  }

  // A repo of its own per test, on a branch off an origin/main holding a.test.ts (tests x and y)
  // and b.test.ts (test z).
  beforeEach(() => {
    repo = scratchRepo("tests-kept-");
    repo.write(FILE_A, 'test("x", () => {});\ntest("y", () => {});\n');
    repo.write(FILE_B, 'test("z", () => {});\n');
    repo.commitAll("base");
    repo.branchOffOriginMain();
  });

  afterEach(() => repo.remove());

  test("nothing changed, or a test added, passes", () => {
    passes();
    repo.write(FILE_B, 'test("z", () => {});\ntest("new", () => {});\n');
    passes();
  });

  test("a cut test fails, before and after it's committed", () => {
    repo.write(FILE_A, 'test("x", () => {});\n');
    refuses("y");
    repo.commitAll("cut y");
    refuses("y");
  });

  test("a test moved to another file, and a test file renamed, pass", () => {
    repo.write(FILE_A, 'test("x", () => {});\n');
    repo.write(FILE_B, 'test("z", () => {});\ntest("y", () => {});\n');
    repo.commitAll("move y");
    passes();
    repo.git("mv", FILE_A, "tests/renamed.test.ts");
    repo.commitAll("rename a");
    passes();
  });

  test("a test file deleted but not yet committed fails", () => {
    rmSync(join(repo.path, FILE_B));
    refuses("z");
  });

  test("a cut test passes once a branch commit's trailer names it with a reason", () => {
    repo.write(FILE_A, 'test("x", () => {});\n');
    repo.commitAll("cut y");
    repo.commitWithTrailer("Test-removed: x: the wrong one");
    refuses("y");
    repo.commitWithTrailer("Test-removed: y: the rule it checked went (#9)");
    passes();
  });

  test("a deleted file fails until a trailer names the file", () => {
    repo.git("rm", "-q", FILE_A);
    repo.commitAll("drop a");
    refuses("x");
    repo.commitWithTrailer(`Test-removed: ${FILE_A}: the feature went`);
    passes();
  });

  test("Test-removed in the commit's subject, not as a trailer, doesn't let the cut through", () => {
    repo.write(FILE_A, 'test("x", () => {});\n');
    repo.git("add", "-A");
    repo.git("commit", "-q", "-m", "Test-removed: y: in the subject");
    refuses("y");
  });

  test("Test-removed above a blank line, not in the last paragraph, is refused, saying where it goes", () => {
    repo.write(FILE_A, 'test("x", () => {});\n');
    repo.commitAll("cut y");
    repo.commitWithTrailerAboveBlankLine("Test-removed: y: the rule it checked went (#9)");
    expect(refuses("y")).toContain(TRAILER_PLACE);
  });

  test("with no origin/main to compare with, it fails, saying to fetch", () => {
    repo.dropOriginMain();
    const { status, said } = check();
    expect(status).toBe(1);
    expect(said).toContain("Run git fetch origin");
  });
});
