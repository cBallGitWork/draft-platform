// scripts/tests-kept.mjs, the never-cut-tests check that `npm run verify` runs: which calls it
// reads as tests and how it names them; which it counts as removed; which trailers let a removal
// through; and, in a scratch repo whose origin/main holds two test files, the check end to end,
// committed or not.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { NAME_JOIN, removedTests, testNames, unexcused } from "../../scripts/tests-kept.mjs";

const SCRIPT = join(import.meta.dirname, "../../scripts/tests-kept.mjs");
const ORIGIN_MAIN = "refs/remotes/origin/main";
const TESTER = ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false"];

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
  const BOTH = 'test("x", () => {});\ntest("y", () => {});\n';
  let repo;
  let env;

  /** git in the scratch repo; a failure throws, so a broken setup never reads as the check's answer. */
  function git(...args) {
    const run = spawnSync("git", [...TESTER, ...args], { cwd: repo, env, encoding: "utf8" });
    if (run.status !== 0) throw new Error(`git ${args.join(" ")}: ${run.stderr}`);
  }

  function write(path, text) {
    mkdirSync(join(repo, dirname(path)), { recursive: true });
    writeFileSync(join(repo, path), text);
  }

  function commitAll(message) {
    git("add", "-A");
    git("commit", "-q", "-m", message);
  }

  /** An empty commit with `trailer` in its body, where git reads trailers. */
  const commitWithTrailer = (trailer) => git("commit", "-q", "--allow-empty", "-m", "why", "-m", trailer);

  function check() {
    const { status, stderr } = spawnSync(process.execPath, [SCRIPT], { cwd: repo, env, encoding: "utf8" });
    return { status, said: stderr };
  }

  const passes = () => expect(check()).toEqual({ status: 0, said: "" });

  function refuses(name) {
    const { status, said } = check();
    expect(status).toBe(1);
    expect(said).toContain(`  ${name}, in`);
  }

  // A repo of its own per test, on a branch off an origin/main holding a.test.ts (tests x and y)
  // and b.test.ts (test z). Git sees no settings but these, and no GIT_* variable.
  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "tests-kept-"));
    env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")));
    Object.assign(env, { HOME: repo, GIT_CONFIG_NOSYSTEM: "1" });
    git("init", "-q", "-b", "main");
    write(FILE_A, BOTH);
    write(FILE_B, 'test("z", () => {});\n');
    commitAll("base");
    git("update-ref", ORIGIN_MAIN, "HEAD");
    git("checkout", "-q", "-b", "work");
  });

  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  test("nothing changed, or a test added, passes", () => {
    passes();
    write(FILE_B, 'test("z", () => {});\ntest("new", () => {});\n');
    passes();
  });

  test("a cut test fails, before and after it's committed", () => {
    write(FILE_A, 'test("x", () => {});\n');
    refuses("y");
    commitAll("cut y");
    refuses("y");
  });

  test("a test moved to another file, and a test file renamed, pass", () => {
    write(FILE_A, 'test("x", () => {});\n');
    write(FILE_B, 'test("z", () => {});\ntest("y", () => {});\n');
    commitAll("move y");
    passes();
    git("mv", FILE_A, "tests/renamed.test.ts");
    commitAll("rename a");
    passes();
  });

  test("a test file deleted but not yet committed fails", () => {
    rmSync(join(repo, FILE_B));
    refuses("z");
  });

  test("a cut test passes once a branch commit's trailer names it with a reason", () => {
    write(FILE_A, 'test("x", () => {});\n');
    commitAll("cut y");
    commitWithTrailer("Test-removed: x: the wrong one");
    refuses("y");
    commitWithTrailer("Test-removed: y: the rule it checked went (#9)");
    passes();
  });

  test("a deleted file passes once a trailer names the file", () => {
    git("rm", "-q", FILE_A);
    git("commit", "-q", "-m", "drop a", "-m", `Test-removed: ${FILE_A}: the feature went`);
    passes();
  });

  test("Test-removed in the commit's subject, not as a trailer, doesn't let the cut through", () => {
    write(FILE_A, 'test("x", () => {});\n');
    git("add", "-A");
    git("commit", "-q", "-m", "Test-removed: y: in the subject");
    refuses("y");
  });

  test("with no origin/main to compare with, it fails, saying to fetch", () => {
    git("update-ref", "-d", ORIGIN_MAIN);
    const { status, said } = check();
    expect(status).toBe(1);
    expect(said).toContain("Run git fetch origin");
  });
});
