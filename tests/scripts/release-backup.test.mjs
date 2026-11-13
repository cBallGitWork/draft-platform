// The backup before a release (spec/20, Rolling back; #1996): a release that could strand saved
// data (a table or field removed, a type narrowed) takes a backup first or stops, and one that
// doesn't, the same shape or only added to, goes straight through, with no export read from the
// live database. The Convex CLI is faked; the shapes are the real convex/schema.ts's.

import { spawnSync } from "node:child_process";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  DEPLOY_ARGS,
  DEPLOY_KEY_SETTING,
  FINGERPRINT_ENV,
  SHAPE_ENV_PREFIX,
  VERCEL_ENV,
  VERCEL_PRODUCTION,
  release,
  schemaJson,
} from "../../scripts/release.mjs";
import { fingerprintOf, savedShape, shapeFingerprint, shapeParts } from "../../scripts/schema-shape.mjs";
import { DEPLOY_KEY } from "../support/scripts/liveSetup.harness.mjs";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";
import { scratchDir } from "../support/scripts/scratchDir.mjs";

const SCRIPT = join(REPO_ROOT, "scripts/release.mjs");
const BACKUP_PATH = "/backups/backup.zip";
const SNAPSHOT = "1730000000000000000";
const OK = { status: 0, stdout: "", stderr: "" };
const SNAPSHOT_LINE = `Created snapshot export at timestamp ${SNAPSHOT}`;
const partEnv = (n) => `${SHAPE_ENV_PREFIX}${n}`;

// The real schema's shape, and the same with one field fewer in its first table: from one to the
// other adds a field, from the other back drops it.
const schema = JSON.parse(await schemaJson(join(REPO_ROOT, "convex/schema.ts")));
const NOW = savedShape(JSON.stringify(schema));
const [firstTable, ...otherTables] = NOW.shape;
const [droppedField, ...keptFields] = Object.entries(firstTable.documentType.value);
const FEWER = {
  ...NOW,
  shape: [{ ...firstTable, documentType: { ...firstTable.documentType, value: Object.fromEntries(keptFields) } }, ...otherTables],
};
const DROPPED = `${firstTable.tableName}.${droppedField[0]}`;

const command = (args) => args.slice(0, 2).join(" ");

/** The live deployment's variables as the last release left them, recording `shape`. */
const recordOf = (shape) => ({
  [FINGERPRINT_ENV]: fingerprintOf(shape),
  ...Object.fromEntries(shapeParts(shape).map((part, at) => [partEnv(at + 1), part])),
});

/** A fake `npx convex`: `env get` answers from `variables`, any command from `answers`, keyed on
 *  its first two words, and the calls are recorded. */
function fakeConvex(variables, answers = {}) {
  const calls = [];
  const convex = (args) => {
    calls.push(args);
    const value = command(args) === "env get" ? variables[args[2]] : undefined;
    return { ...OK, ...(value === undefined ? {} : { stdout: `${value}\n` }), ...answers[command(args)] };
  };
  return { convex, calls, commands: () => calls.map(command) };
}

function run({ shape, live = NOW, variables = live === null ? {} : recordOf(live), answers = {} }) {
  const fake = fakeConvex(variables, answers);
  const lines = [];
  const code = release({ convex: fake.convex, shape, backupPath: BACKUP_PATH, log: (line) => lines.push(line) });
  return { code, ...fake, said: lines.join("\n") };
}

const exported = { "export --path": { stdout: "", stderr: `${SNAPSHOT_LINE}\n` } };
const readFingerprint = ["env", "get", FINGERPRINT_ENV];
const BACKUP = ["export", "--path", BACKUP_PATH];
/** The calls that read `shape`'s record: each part, then the unset one after. */
const reading = (shape) => [...shapeParts(shape), ""].map((_, at) => ["env", "get", partEnv(at + 1)]);
/** The calls that record `shape` after a deploy: each part, a look for one left over, its fingerprint. */
function recording(shape) {
  const parts = shapeParts(shape);
  return [
    ...parts.map((part, at) => ["env", "set", partEnv(at + 1), part]),
    ["env", "get", partEnv(parts.length + 1)],
    ["env", "set", FINGERPRINT_ENV, fingerprintOf(shape)],
  ];
}
const commandsOf = (calls) => calls.map(command);

test("no change to saved data's shape: it deploys straight away, taking no backup and recording nothing", () => {
  const { code, calls, said } = run({ shape: NOW });
  expect(code).toBe(0);
  expect(calls).toEqual([readFingerprint, DEPLOY_ARGS]);
  expect(said).toContain("no backup needed");
});

test("a field added: no backup is read from the live database; it deploys, then records the new shape", () => {
  const { code, calls, said } = run({ shape: NOW, live: FEWER });
  expect(code).toBe(0);
  expect(calls).toEqual([readFingerprint, ...reading(FEWER), DEPLOY_ARGS, ...recording(NOW)]);
  expect(said).toContain("strands nothing: no backup needed");
});

test("a field removed: a backup is taken, naming the field, then it deploys, then the new shape is recorded", () => {
  const { code, calls, said } = run({ shape: FEWER, answers: exported });
  expect(code).toBe(0);
  expect(calls).toEqual([readFingerprint, ...reading(NOW), BACKUP, DEPLOY_ARGS, ...recording(FEWER)]);
  expect(said).toContain(`could strand saved data (${DROPPED}`);
  expect(said).toContain(`Backup taken: snapshot ${SNAPSHOT}`);
});

test("a changed shape whose backup fails: the release stops before deploying, and says why", () => {
  const { code, calls, said } = run({ shape: FEWER, answers: { "export --path": { status: 1, stderr: "too many backups" } } });
  expect(code).toBe(1);
  expect(calls).toEqual([readFingerprint, ...reading(NOW), BACKUP]);
  expect(said).toContain("Release stopped, nothing went live");
  expect(said).toContain("too many backups");
});

test("a first release, with no shape on record yet, backs up first", () => {
  const { code, calls, said } = run({ shape: NOW, live: null, answers: exported });
  expect(code).toBe(0);
  expect(calls).toEqual([readFingerprint, BACKUP, DEPLOY_ARGS, ...recording(NOW)]);
  expect(said).toContain("no record of its schema yet");
});

test("a fingerprint on record with no shape beside it, as releases before #1996 left it, backs up first", () => {
  const { code, calls, said } = run({ shape: NOW, variables: { [FINGERPRINT_ENV]: fingerprintOf(FEWER) }, answers: exported });
  expect(code).toBe(0);
  expect(calls).toEqual([readFingerprint, ["env", "get", partEnv(1)], BACKUP, DEPLOY_ARGS, ...recording(NOW)]);
  expect(said).toContain("record of its schema can't be read");
});

test("a recorded shape that doesn't match its fingerprint backs up first", () => {
  const variables = { ...recordOf(FEWER), [FINGERPRINT_ENV]: "a".repeat(64) };
  const { calls, said } = run({ shape: NOW, variables, answers: exported });
  expect(calls).toContainEqual(BACKUP);
  expect(said).toContain("record of its schema can't be read");
});

test("a recorded shape longer than the new one: its leftover parts are removed before the fingerprint is set", () => {
  const after = shapeParts(NOW).length + 1;
  const variables = { ...recordOf(FEWER), [partEnv(after)]: "left over" };
  const { calls } = run({ shape: NOW, variables, answers: exported });
  expect(calls.slice(-4)).toEqual([
    ["env", "get", partEnv(after)],
    ["env", "remove", partEnv(after)],
    ["env", "get", partEnv(after + 1)],
    ["env", "set", FINGERPRINT_ENV, fingerprintOf(NOW)],
  ]);
});

test("a schema that can't be read backs up first, and records nothing", () => {
  const { code, commands, said } = run({ shape: null, answers: exported });
  expect(code).toBe(0);
  expect(commands()).toEqual(["env get", "export --path", "deploy --cmd"]);
  expect(said).toContain("to be safe");
});

test("the live record can't be read: the release stops before backing up or deploying", () => {
  const { code, commands, said } = run({ shape: FEWER, answers: { "env get": { status: 1, stderr: "no deploy key" } } });
  expect(code).toBe(1);
  expect(commands()).toEqual(["env get"]);
  expect(said).toContain("no deploy key");
});

test("a failed deploy fails the release with its exit code, and records nothing", () => {
  const { code, calls } = run({ shape: FEWER, answers: { ...exported, "deploy --cmd": { status: 3 } } });
  expect(code).toBe(3);
  expect(calls).toEqual([readFingerprint, ...reading(NOW), BACKUP, DEPLOY_ARGS]);
});

test("released but the record fails: the release still passes, saying the next one will back up again", () => {
  const { code, calls, said } = run({ shape: FEWER, answers: { ...exported, "env set": { status: 1, stderr: "offline" } } });
  expect(code).toBe(0);
  expect(calls).toEqual([readFingerprint, ...reading(NOW), BACKUP, DEPLOY_ARGS, recording(FEWER)[0]]);
  expect(said).toContain("the next release will take a backup");
});

// The fingerprint, from the real convex/schema.ts.
const withTables = (tables) => JSON.stringify({ ...schema, tables });

test("esbuild is pinned to the version Convex bundles with, so there is one copy", () => {
  const lock = JSON.parse(readFileSync(join(REPO_ROOT, "package-lock.json"), "utf8"));
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
  expect(pkg.devDependencies.esbuild).toBe(lock.packages["node_modules/convex"].dependencies.esbuild);
});

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

// The script as Vercel runs it, in a production build with its deploy key, and a fake `npx` first
// on the PATH, answering `env get` from the live deployment's `variables`.
function runScript(variables) {
  const scratch = scratchDir("release-test-");
  const callLog = join(scratch, "calls");
  const npx = join(scratch, "npx");
  writeFileSync(
    npx,
    [
      "#!/bin/sh",
      `echo "$*" >> "${callLog}"`,
      ...Object.entries(variables).map(([name, value]) => `if [ "$2 $3 $4" = "env get ${name}" ]; then echo "${value}"; fi`),
      `if [ "$2" = "export" ]; then echo "${SNAPSHOT_LINE}" >&2; fi`,
      "exit 0",
    ].join("\n"),
  );
  chmodSync(npx, 0o755);
  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${scratch}:${process.env.PATH}`,
      [VERCEL_ENV]: VERCEL_PRODUCTION,
      [DEPLOY_KEY_SETTING]: DEPLOY_KEY,
    },
  });
  return { status: result.status, output: result.stdout + result.stderr, calls: readFileSync(callLog, "utf8").trim().split("\n") };
}

test("run as the build command, a schema that matches the live one deploys with no backup", () => {
  const { status, calls } = runScript(recordOf(NOW));
  expect(status).toBe(0);
  expect(calls).toEqual([`convex env get ${FINGERPRINT_ENV}`, `convex ${DEPLOY_ARGS.join(" ")}`]);
});

test("run as the build command, a schema that only adds to the live one deploys with no backup", () => {
  const { status, output, calls } = runScript(recordOf(FEWER));
  expect(status).toBe(0);
  expect(calls).toEqual(
    [readFingerprint, ...reading(FEWER), DEPLOY_ARGS, ...recording(NOW)].map((call) => `convex ${call.join(" ")}`),
  );
  expect(output).toContain("strands nothing: no backup needed");
});

test("run as the build command, a schema that differs from the live one is backed up first", () => {
  const { status, output, calls } = runScript({ [FINGERPRINT_ENV]: "a".repeat(64) });
  expect(status).toBe(0);
  expect(calls.map((call) => command(call.split(" ").slice(1)))).toEqual(
    commandsOf([readFingerprint, ["env", "get", partEnv(1)], BACKUP, DEPLOY_ARGS, ...recording(NOW)]),
  );
  expect(output).toContain(`Backup taken: snapshot ${SNAPSHOT}`);
});

test("run as the build command, the recorded shape isn't printed to the build log", () => {
  const [part] = shapeParts(FEWER);
  const { output } = runScript(recordOf(FEWER));
  expect(output).not.toContain(part);
});
