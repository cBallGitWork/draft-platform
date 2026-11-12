// scripts/unused-exports.mjs, the unused-exports check that `npm run verify` runs (#1811): which
// exports it reads as Convex registrations and re-exports, what tests read, which findings fail,
// how the baseline pins them, and, in a scratch project knip reads, the check end to end.

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import {
  BASELINE_PATH, baselineProblems, knipFindings, lineOf, readsOf, reexportedNames, registeredNames, unusedExports,
} from "../../scripts/unused-exports.mjs";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";
import { scratchDir } from "../support/scripts/scratchDir.mjs";

const SCRIPT = join(REPO_ROOT, "scripts/unused-exports.mjs");

/** A folder holding `files` (path to text), and the function writing more into it. */
function project(files) {
  const root = scratchDir("unused-exports-");
  const write = (path, text) => {
    mkdirSync(join(root, dirname(path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  for (const [path, text] of Object.entries(files)) write(path, text);
  return { root, write };
}

describe("reexportedNames", () => {
  test("names `export { } from` and an imported binding exported again, not a file's own export", () => {
    const text = `
      import { a } from "./a";
      import type { T } from "./t";
      const own = 1;
      export const mine = 2;
      export { a, own };
      export type { T };
      export { b as renamed } from "./b";`;
    expect([...reexportedNames("x.ts", text)].sort()).toEqual(["T", "a", "renamed"]);
  });
});

describe("registeredNames", () => {
  test("names an export holding a Convex registration, not one holding another call", () => {
    const text = `
      export const list = query({ handler: async () => [] });
      export const run = internalMutation({ handler: async () => null });
      export const shape = v.object({});
      const hidden = mutation({ handler: async () => null });`;
    expect([...registeredNames("convex/x.ts", text)].sort()).toEqual(["list", "run"]);
  });
});

describe("readsOf", () => {
  test("maps each module a test imports to the names it reads, or all of them", () => {
    const { root } = project({ "src/a.ts": "", "src/b.tsx": "", "src/c.ts": "", "scripts/d.mjs": "", "src/e.ts": "" });
    const test = `
      import { one, two as renamed } from "../src/a";
      import Default from "../src/b";
      import * as all from "../src/c";
      export { three } from "../scripts/d.mjs";
      vi.mock("../src/e", () => ({}));
      import { vi } from "vitest";`;
    const reads = readsOf(root, [["tests/x.test.ts", test]]);
    expect(Object.fromEntries([...reads].map(([file, names]) => [file, [...names]]))).toEqual({
      "src/a.ts": ["one", "two"],
      "src/b.tsx": ["default"],
      "src/c.ts": ["*"],
      "scripts/d.mjs": ["three"],
      "src/e.ts": ["*"],
    });
  });
});

describe("unusedExports", () => {
  const TEXTS = {
    "src/a.ts": 'export const forTest = 1;\nexport { shared } from "./shared";\nexport const nobody = 2;',
    "convex/x.ts": "export const list = query({});\nexport const helper = 1;",
  };
  const textOf = (file) => TEXTS[file];
  const finding = (file, name) => ({ file, name });

  test("a test's read lets a constant through, but not a re-export", () => {
    const reads = new Map([["src/a.ts", new Set(["forTest", "shared"])]]);
    const findings = [finding("src/a.ts", "forTest"), finding("src/a.ts", "shared"), finding("src/a.ts", "nobody")];
    expect(unusedExports(findings, textOf, reads)).toEqual([finding("src/a.ts", "shared"), finding("src/a.ts", "nobody")]);
  });

  test("Convex's registrations, its read defaults and auth.ts are dropped; a Convex helper isn't", () => {
    const findings = [
      finding("convex/x.ts", "list"), finding("convex/x.ts", "helper"), finding("convex/crons.ts", "default"),
      finding("convex/schema.ts", "default"), finding("convex/auth.ts", "signIn"),
    ];
    expect(unusedExports(findings, textOf, new Map())).toEqual([finding("convex/x.ts", "helper")]);
  });
});

test("knipFindings reads knip's exports and types, each by file and name", () => {
  const report = { issues: [{ file: "a.ts", exports: [{ name: "x", line: 1 }], types: [{ name: "T" }] }, { file: "b.ts" }] };
  expect(knipFindings(report).map(lineOf)).toEqual(["a.ts: x", "a.ts: T"]);
});

test("baselineProblems names a finding it doesn't pin and a pinned line no longer found", () => {
  expect(baselineProblems([{ file: "a.ts", name: "x" }], ["a.ts: x"])).toEqual({ unpinned: [], stale: [] });
  expect(baselineProblems([{ file: "a.ts", name: "x" }], ["b.ts: gone"])).toEqual({ unpinned: ["a.ts: x"], stale: ["b.ts: gone"] });
});

describe("the check in a project", () => {
  const DUMMY = "src/used.ts: DUMMY_UNUSED";
  let scratch;

  const check = () => {
    const { status, stderr } = spawnSync(process.execPath, [SCRIPT], { cwd: scratch.root, encoding: "utf8" });
    return { status, said: stderr };
  };

  // An app whose src/used.ts exports `used`, which main.ts reads, `forTest`, which only a test
  // reads, and DUMMY_UNUSED, which nothing reads.
  beforeEach(() => {
    scratch = project({
      "package.json": '{ "name": "scratch", "private": true, "type": "module" }',
      "knip.json": JSON.stringify({
        entry: ["src/main.ts!", "tests/**/*.test.ts"],
        project: ["src/**/*.ts!", "tests/**/*.ts"],
        ignoreExportsUsedInFile: false,
        includeEntryExports: true,
      }),
      "src/main.ts": 'import { used } from "./used";\nconsole.log(used);\n',
      "src/used.ts": "export const used = 1;\nexport const forTest = 2;\nexport const DUMMY_UNUSED = 3;\n",
      "tests/used.test.ts": 'import { forTest } from "../src/used";\nconsole.log(forTest);\n',
    });
  });

  test("an export nothing reads fails, named; one only a test reads doesn't", () => {
    const { status, said } = check();
    expect(status).toBe(1);
    expect(said).toContain(`  ${DUMMY}\n`);
    expect(said).not.toContain("forTest");
  });

  test("pinned in the baseline it passes, and a stale baseline line fails", () => {
    scratch.write(BASELINE_PATH, `${DUMMY}\n`);
    expect(check()).toEqual({ status: 0, said: "" });
    scratch.write(BASELINE_PATH, `${DUMMY}\nsrc/gone.ts: GONE\n`);
    const { status, said } = check();
    expect(status).toBe(1);
    expect(said).toContain("no longer found");
    expect(said).toContain("  src/gone.ts: GONE");
  });
});
