// The backup before a release (spec/20, Rolling back): a release that changes saved data's shape
// takes a backup first or stops, and one that doesn't goes straight through. The Convex CLI is faked.

import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { DEPLOY_ARGS, FINGERPRINT_ENV, release, schemaJson, shapeFingerprint } from "../../scripts/release.mjs";

const REPO = join(import.meta.dirname, "../..");
const SCRIPT = join(REPO, "scripts/release.mjs");
const BACKUP_PATH = "/backups/backup.zip";
const LIVE = "a".repeat(64);
const CHANGED = "b".repeat(64);
const SNAPSHOT = "1730000000000000000";
const OK = { status: 0, stdout: "", stderr: "" };
const SNAPSHOT_LINE = `Created snapshot export at timestamp ${SNAPSHOT}`;

const command = (args) => args.slice(0, 2).join(" ");

/** A fake `npx convex`: answers each command from `answers`, keyed on its first two words, and records the calls. */
function fakeConvex(answers = {}) {
  const calls = [];
  const convex = (args) => {
    calls.push(args);
    return { ...OK, ...answers[command(args)] };
  };
  return { convex, calls, commands: () => calls.map(command) };
}

function run({ fingerprint, live = LIVE, answers = {} }) {
  const fake = fakeConvex({ "env get": { stdout: live === null ? "" : `${live}\n` }, ...answers });
  const lines = [];
  const code = release({ convex: fake.convex, fingerprint, backupPath: BACKUP_PATH, log: (line) => lines.push(line) });
  return { code, ...fake, said: lines.join("\n") };
}

const exported = { "export --path": { stdout: "", stderr: `${SNAPSHOT_LINE}\n` } };

test("no change to saved data's shape: it deploys straight away, taking no backup and recording nothing", () => {
  const { code, calls, said } = run({ fingerprint: LIVE });
  expect(code).toBe(0);
  expect(calls).toEqual([["env", "get", FINGERPRINT_ENV], DEPLOY_ARGS]);
  expect(said).toContain("no backup needed");
});

test("a changed shape: a backup is taken, then it deploys, then the new shape is recorded", () => {
  const { code, calls, said } = run({ fingerprint: CHANGED, answers: exported });
  expect(code).toBe(0);
  expect(calls).toEqual([
    ["env", "get", FINGERPRINT_ENV],
    ["export", "--path", BACKUP_PATH],
    DEPLOY_ARGS,
    ["env", "set", FINGERPRINT_ENV, CHANGED],
  ]);
  expect(said).toContain(`Backup taken: snapshot ${SNAPSHOT}`);
});

test("a changed shape whose backup fails: the release stops before deploying, and says why", () => {
  const { code, commands, said } = run({ fingerprint: CHANGED, answers: { "export --path": { status: 1, stderr: "too many backups" } } });
  expect(code).toBe(1);
  expect(commands()).toEqual(["env get", "export --path"]);
  expect(said).toContain("Release stopped, nothing went live");
  expect(said).toContain("too many backups");
});

test("a first release, with no shape on record yet, backs up first", () => {
  const { code, commands, said } = run({ fingerprint: CHANGED, live: null, answers: exported });
  expect(code).toBe(0);
  expect(commands()).toEqual(["env get", "export --path", "deploy --cmd", "env set"]);
  expect(said).toContain("no record of its schema yet");
});

test("a schema that can't be read backs up first, and records nothing", () => {
  const { code, commands, said } = run({ fingerprint: null, answers: exported });
  expect(code).toBe(0);
  expect(commands()).toEqual(["env get", "export --path", "deploy --cmd"]);
  expect(said).toContain("to be safe");
});

test("the live record can't be read: the release stops before backing up or deploying", () => {
  const { code, commands, said } = run({ fingerprint: CHANGED, answers: { "env get": { status: 1, stderr: "no deploy key" } } });
  expect(code).toBe(1);
  expect(commands()).toEqual(["env get"]);
  expect(said).toContain("no deploy key");
});

test("a failed deploy fails the release with its exit code, and records nothing", () => {
  const { code, commands } = run({ fingerprint: CHANGED, answers: { ...exported, "deploy --cmd": { status: 3 } } });
  expect(code).toBe(3);
  expect(commands()).toEqual(["env get", "export --path", "deploy --cmd"]);
});

test("released but the record fails: the release still passes, saying the next one will back up again", () => {
  const { code, commands, said } = run({ fingerprint: CHANGED, answers: { ...exported, "env set": { status: 1, stderr: "offline" } } });
  expect(code).toBe(0);
  expect(commands()).toEqual(["env get", "export --path", "deploy --cmd", "env set"]);
  expect(said).toContain("the next release will take a backup");
});

// The fingerprint, from the real convex/schema.ts.
const schema = JSON.parse(await schemaJson(join(REPO, "convex/schema.ts")));
const withTables = (tables) => JSON.stringify({ ...schema, tables });

test("the fingerprint reads the real schema, and is the same each time", () => {
  expect(schema.tables.length).toBeGreaterThan(0);
  expect(shapeFingerprint(JSON.stringify(schema))).toBe(shapeFingerprint(JSON.stringify(schema)));
});

test("an index or the tables' order isn't a change of shape; a dropped table or a changed field is", () => {
  const before = shapeFingerprint(JSON.stringify(schema));
  const [first, ...rest] = schema.tables;
  expect(shapeFingerprint(withTables([{ ...first, indexes: [] }, ...rest]))).toBe(before);
  expect(shapeFingerprint(withTables([...rest, first]))).toBe(before);
  expect(shapeFingerprint(withTables(rest))).not.toBe(before);
  expect(shapeFingerprint(withTables([{ ...first, documentType: { type: "any" } }, ...rest]))).not.toBe(before);
});

// The script as Vercel runs it, with a fake `npx` first on the PATH.
let scratch;
afterEach(() => scratch && rmSync(scratch, { recursive: true, force: true }));

function runScript(liveFingerprint) {
  scratch = mkdtempSync(join(tmpdir(), "release-test-"));
  const callLog = join(scratch, "calls");
  const npx = join(scratch, "npx");
  writeFileSync(
    npx,
    [
      "#!/bin/sh",
      `echo "$*" >> "${callLog}"`,
      `if [ "$2 $3" = "env get" ]; then echo "${liveFingerprint}"; fi`,
      `if [ "$2" = "export" ]; then echo "${SNAPSHOT_LINE}" >&2; fi`,
      "exit 0",
    ].join("\n"),
  );
  chmodSync(npx, 0o755);
  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: REPO,
    encoding: "utf8",
    env: { ...process.env, PATH: `${scratch}:${process.env.PATH}` },
  });
  return { status: result.status, output: result.stdout + result.stderr, calls: readFileSync(callLog, "utf8").trim().split("\n") };
}

test("run as the build command, a schema that matches the live one deploys with no backup", () => {
  const { status, calls } = runScript(shapeFingerprint(JSON.stringify(schema)));
  expect(status).toBe(0);
  expect(calls).toEqual([`convex env get ${FINGERPRINT_ENV}`, `convex ${DEPLOY_ARGS.join(" ")}`]);
});

test("run as the build command, a schema that differs from the live one is backed up first", () => {
  const { status, output, calls } = runScript(LIVE);
  expect(status).toBe(0);
  expect(calls.map((call) => command(call.split(" ").slice(1)))).toEqual(["env get", "export --path", "deploy --cmd", "env set"]);
  expect(output).toContain(`Backup taken: snapshot ${SNAPSHOT}`);
});
