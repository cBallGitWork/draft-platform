// scripts/recorded-add-only.mjs, the add-only check on recorded feed payloads and goldens that
// `npm run verify` runs: in a scratch repo whose origin/main holds two payloads and a golden, adding
// one passes; changing, deleting or renaming one fails, committed or not, unless a branch commit
// carries "Re-record: <file>: <why>" for it.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";

const SCRIPT = join(import.meta.dirname, "../../scripts/recorded-add-only.mjs");
const RECORDED = "tests/support/recorded";
const PAYLOAD_A = `${RECORDED}/a.json`;
const PAYLOAD_B = `${RECORDED}/b.json`;
const GOLDEN_SCHEMA = "tests/support/golden/schema.json";
const ORIGIN_MAIN = "refs/remotes/origin/main";
const TESTER = ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false"];

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

/** Commits every change in the scratch repo. */
function commitAll(message) {
  git("add", "-A");
  git("commit", "-q", "-m", message);
}

/** The line a branch commit carries to re-record `file` on purpose. */
const reRecord = (file, why) => `Re-record: ${file}: ${why}`;

/** An empty commit with `trailer` in its body, where git reads trailers. */
const commitWithTrailer = (trailer) => git("commit", "-q", "--allow-empty", "-m", "why", "-m", trailer);

const editPayloadA = () => write(PAYLOAD_A, '{"a":2}\n');

/** a.json edited in a commit on the branch, with no trailer yet. */
function commitEditToPayloadA() {
  editPayloadA();
  commitAll("edit a");
}

/** The check run in the scratch repo: how it ended and what it said on stderr. */
function check() {
  const { status, stderr } = spawnSync(process.execPath, [SCRIPT], { cwd: repo, env, encoding: "utf8" });
  return { status, said: stderr };
}

const passes = () => expect(check()).toEqual({ status: 0, said: "" });

/** The check fails, naming `path` as the file it refused. */
function refuses(path) {
  const { status, said } = check();
  expect(status).toBe(1);
  expect(said).toContain(`changes or deletes ${path}`);
}

// A repo of its own per test, on a branch off an origin/main holding a.json, b.json and the golden
// schema.json. Git sees no settings but these: none of the machine's, and no GIT_* variable (a git
// hook running the tests would point git at the real checkout).
beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "recorded-add-only-"));
  env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")));
  Object.assign(env, { HOME: repo, GIT_CONFIG_NOSYSTEM: "1" });
  git("init", "-q", "-b", "main");
  write(PAYLOAD_A, '{"a":1}\n');
  write(PAYLOAD_B, '{"b":1}\n');
  write(GOLDEN_SCHEMA, '{"v":1}\n');
  commitAll("base");
  git("update-ref", ORIGIN_MAIN, "HEAD");
  git("checkout", "-q", "-b", "work");
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

test("nothing changed passes", () => {
  passes();
});

test("a new payload passes, before and after it's committed", () => {
  write(`${RECORDED}/c.json`, '{"c":1}\n');
  passes();
  commitAll("add c");
  passes();
});

test("a file changed outside the two folders passes", () => {
  write("other.txt", "x\n");
  commitAll("other");
  passes();
});

test("a changed payload fails, before and after it's committed", () => {
  editPayloadA();
  refuses(PAYLOAD_A);
  commitAll("edit a");
  refuses(PAYLOAD_A);
});

test("a trailer naming another file doesn't let the change through", () => {
  commitEditToPayloadA();
  commitWithTrailer(reRecord("b.json", "the feed changed"));
  refuses(PAYLOAD_A);
});

test("a trailer with no reason doesn't let the change through", () => {
  commitEditToPayloadA();
  commitWithTrailer(reRecord("a.json", ""));
  refuses(PAYLOAD_A);
});

test("Re-record in the commit's subject, not as a trailer, doesn't let the change through", () => {
  commitEditToPayloadA();
  git("commit", "-q", "--allow-empty", "-m", reRecord("a.json", "in the subject, not a trailer"));
  refuses(PAYLOAD_A);
});

test("a trailer naming the file by its name in its folder, with a reason, lets the change through", () => {
  commitEditToPayloadA();
  commitWithTrailer(reRecord("a.json", "FPL renamed a key"));
  passes();
});

test("a deleted payload fails until a trailer names it by its path", () => {
  git("rm", "-q", PAYLOAD_B);
  commitAll("drop b");
  refuses(PAYLOAD_B);
  commitWithTrailer(reRecord(PAYLOAD_B, "cut down"));
  passes();
});

test("a renamed payload fails, as the old file's deletion", () => {
  git("mv", PAYLOAD_A, `${RECORDED}/a2.json`);
  commitAll("rename a");
  refuses(PAYLOAD_A);
});

test("an edited golden fails until a trailer names it", () => {
  write(GOLDEN_SCHEMA, '{"v":2}\n');
  commitAll("edit golden");
  refuses(GOLDEN_SCHEMA);
  commitWithTrailer(reRecord("schema.json", "a new stat in the schema"));
  passes();
});

test("with no origin/main to compare with, it fails, saying to fetch", () => {
  git("update-ref", "-d", ORIGIN_MAIN);
  const { status, said } = check();
  expect(status).toBe(1);
  expect(said).toContain("Run git fetch origin");
});
