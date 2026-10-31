import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import config from "../../vitest.config.ts";

// A typed import.meta.glob must see a file added since the last run; why it didn't is beside
// `fsModuleCache` in vitest.config.ts (#766). This runs the real Vitest twice in a scratch folder,
// adding a file between the runs, with the repo's setting and, as a control that the probe catches
// a stale list, with the cache on.

const VITEST = join(import.meta.dirname, "../../node_modules/vitest/vitest.mjs");
const PROBE = "probe.test.ts";
const PIECES = "pieces";
const PIECE_EXTENSION = ".mjs";
// A cold Vitest start takes about a second, and coverage about doubles that. spawnSync blocks, so
// Vitest's own timeout can't stop a hung inner run: each is killed at its own limit, and the test's
// timeout allows for two and the scratch folder's setup.
const RUN_TIMEOUT_MS = 25_000;
const SETUP_ALLOWANCE_MS = 5_000;
const TWO_RUNS_TIMEOUT_MS = 2 * RUN_TIMEOUT_MS + SETUP_ALLOWANCE_MS;
// What the probe prints when its glob holds the one piece and the disk holds two.
const STALE_GLOB = "expected 1 to be 2";

// The probe's glob, written with a type like generatedApi.test.ts's, against the files really on
// disk: equal only when the glob is fresh.
const PROBE_SOURCE = `import { readdirSync } from "node:fs";
test("the glob lists every piece on disk", () => {
  const globbed = Object.keys(import.meta.glob<string>("./${PIECES}/*${PIECE_EXTENSION}")).length;
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
  writeFileSync(join(scratch, PIECES, `${name}${PIECE_EXTENSION}`), `export default "${name}";\n`);
}

// The inner run must not think it is a worker of this one.
const envWithoutOuterVitest = () =>
  Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("VITEST")));

function vitestRun() {
  const run = spawnSync(process.execPath, [VITEST, "run", "--root", scratch], {
    cwd: scratch,
    env: envWithoutOuterVitest(),
    encoding: "utf8",
    timeout: RUN_TIMEOUT_MS,
  });
  return { passed: run.status === 0, output: run.stdout + run.stderr };
}

// The second run, after a piece is added to a first run that passed.
function secondRunAfterAFileIsAdded(fsModuleCache) {
  scratchProject(fsModuleCache);
  const first = vitestRun();
  expect(first.passed, first.output).toBe(true);
  addPiece("b");
  return vitestRun();
}

test(
  "with vitest.config.ts's setting, a glob sees a file added since the last run",
  () => {
    const second = secondRunAfterAFileIsAdded(config.test.fsModuleCache);
    expect(second.passed, second.output).toBe(true);
  },
  TWO_RUNS_TIMEOUT_MS,
);

// If this fails after a Vitest upgrade, Vitest now skips or re-keys a typed glob too, and
// vitest.config.ts's `fsModuleCache: false` can go.
test(
  "with the module cache on, the same glob keeps its old list (the probe catches a stale glob)",
  () => {
    const second = secondRunAfterAFileIsAdded(true);
    expect(second.passed, second.output).toBe(false);
    expect(second.output).toContain(STALE_GLOB);
  },
  TWO_RUNS_TIMEOUT_MS,
);
