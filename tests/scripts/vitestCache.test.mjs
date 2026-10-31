import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import config from "../../vitest.config.ts";

// A test that lists files with import.meta.glob must see a file added since the last run (#766).
// Vitest 5's on-disk module cache reuses a file's transform while its own source is unchanged. It
// skips a file holding the text `import.meta.glob(`, but not one written with a type, as
// tests/convex/generatedApi.test.ts writes `import.meta.glob<string>(`, so that glob kept its old
// list; vitest.config.ts turns the cache off. This runs the real Vitest twice in a scratch folder,
// adding a file between the runs, with the repo's setting and, as a control that the probe catches
// a stale list, with the cache on.

const VITEST = join(import.meta.dirname, "../../node_modules/vitest/vitest.mjs");
const PROBE = "probe.test.ts";
const PIECES = "pieces";
// Two cold Vitest starts per test, and coverage about doubles that.
const TWO_RUNS_TIMEOUT_MS = 60_000;

// The probe's glob, written with a type like generatedApi.test.ts's, against the files really on
// disk: equal only when the glob is fresh.
const PROBE_SOURCE = `import { readdirSync } from "node:fs";
test("the glob lists every piece on disk", () => {
  const globbed = Object.keys(import.meta.glob<string>("./${PIECES}/*.mjs")).length;
  expect(globbed).toBe(readdirSync(new URL("./${PIECES}/", import.meta.url)).length);
});
`;

let scratch;
afterEach(() => scratch && rmSync(scratch, { recursive: true, force: true }));

function scratchProject(fsModuleCache) {
  scratch = mkdtempSync(join(tmpdir(), "vitest-cache-"));
  mkdirSync(join(scratch, PIECES));
  const scratchConfig = {
    test: { globals: true, include: [PROBE], fsModuleCache, fsModuleCachePath: join(scratch, "cache") },
  };
  writeFileSync(join(scratch, "vitest.config.mjs"), `export default ${JSON.stringify(scratchConfig)};\n`);
  writeFileSync(join(scratch, PROBE), PROBE_SOURCE);
  addPiece("a");
}

function addPiece(name) {
  writeFileSync(join(scratch, PIECES, `${name}.mjs`), `export default "${name}";\n`);
}

// The inner run must not think it is a worker of this one.
const outerVitestRemoved = () =>
  Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("VITEST")));

function vitestRun() {
  const run = spawnSync(process.execPath, [VITEST, "run", "--root", scratch], {
    cwd: scratch,
    env: outerVitestRemoved(),
    encoding: "utf8",
  });
  return { passed: run.status === 0, output: run.stdout + run.stderr };
}

// Whether the second run, after a piece is added, still passes.
function secondRunPassesAfterAFileIsAdded(fsModuleCache) {
  scratchProject(fsModuleCache);
  const first = vitestRun();
  expect(first.passed, first.output).toBe(true);
  addPiece("b");
  return vitestRun();
}

test(
  "with vitest.config.ts's setting, a glob sees a file added since the last run",
  () => {
    expect(config.test.fsModuleCache).toBe(false);
    const second = secondRunPassesAfterAFileIsAdded(config.test.fsModuleCache);
    expect(second.passed, second.output).toBe(true);
  },
  TWO_RUNS_TIMEOUT_MS,
);

// If this fails after a Vitest upgrade, Vitest now skips or re-keys a typed glob too, and
// vitest.config.ts's `fsModuleCache: false` can go.
test(
  "with the module cache on, the same glob keeps its old list (the probe catches a stale glob)",
  () => {
    const second = secondRunPassesAfterAFileIsAdded(true);
    expect(second.passed, second.output).toBe(false);
  },
  TWO_RUNS_TIMEOUT_MS,
);
