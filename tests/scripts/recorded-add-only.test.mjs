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
const GOLDEN = "tests/support/golden";
const A = `${RECORDED}/a.json`;
const B = `${RECORDED}/b.json`;
const SCHEMA = `${GOLDEN}/schema.json`;
const BASE = "refs/remotes/origin/main";
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

/** A commit with `trailer` in its body, as a branch commit that re-records a file carries it. */
const commitWithTrailer = (trailer) => git("commit", "-q", "--allow-empty", "-m", "why", "-m", trailer);

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

// A repo of its own per test, on a branch `work` off an origin/main holding a.json, b.json and the
// golden schema.json. Git sees no settings but these: none of the machine's, and no GIT_* variable
// (a git hook running the tests would point git at the real checkout).
beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "recorded-add-only-"));
  env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")));
  Object.assign(env, { HOME: repo, GIT_CONFIG_NOSYSTEM: "1" });
  git("init", "-q", "-b", "main");
  write(A, '{"a":1}\n');
  write(B, '{"b":1}\n');
  write(SCHEMA, '{"v":1}\n');
  git("add", "tests");
  git("commit", "-q", "-m", "base");
  git("update-ref", BASE, "HEAD");
  git("checkout", "-q", "-b", "work");
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

test("nothing changed passes", () => {
  passes();
});

test("a new file passes, before and after it's committed", () => {
  write(`${RECORDED}/c.json`, '{"c":1}\n');
  passes();
  git("add", `${RECORDED}/c.json`);
  git("commit", "-q", "-m", "add c");
  passes();
});

test("a file changed outside the two folders passes", () => {
  write("other.txt", "x\n");
  git("add", "other.txt");
  git("commit", "-q", "-m", "other");
  passes();
});

test("a changed payload fails, before and after it's committed", () => {
  write(A, '{"a":2}\n');
  refuses(A);
  git("add", "tests");
  git("commit", "-q", "-m", "edit a");
  refuses(A);
});

/** a.json changed in a commit on the branch, with no trailer yet. */
function changeA() {
  write(A, '{"a":2}\n');
  git("add", "tests");
  git("commit", "-q", "-m", "edit a");
}

test("a trailer naming another file doesn't let the change through", () => {
  changeA();
  commitWithTrailer("Re-record: b.json: the feed changed");
  refuses(A);
});

test("a trailer with no reason doesn't let the change through", () => {
  changeA();
  commitWithTrailer("Re-record: a.json:");
  refuses(A);
});

test("Re-record in the commit's subject, not as a trailer, doesn't let the change through", () => {
  changeA();
  git("commit", "-q", "--allow-empty", "-m", "Re-record: a.json: in the subject, not a trailer");
  refuses(A);
});

test("a trailer naming the file by its name in its folder, with a reason, lets the change through", () => {
  changeA();
  commitWithTrailer("Re-record: a.json: FPL renamed a key");
  passes();
});

test("a deleted payload fails until a trailer names it by its path", () => {
  git("rm", "-q", B);
  git("commit", "-q", "-m", "drop b");
  refuses(B);
  commitWithTrailer(`Re-record: ${B}: cut down`);
  passes();
});

test("a renamed payload fails, as the old file's deletion", () => {
  git("mv", A, `${RECORDED}/a2.json`);
  git("commit", "-q", "-m", "rename a");
  refuses(A);
});

test("an edited golden fails until a trailer names it", () => {
  write(SCHEMA, '{"v":2}\n');
  git("add", "tests");
  git("commit", "-q", "-m", "edit golden");
  refuses(SCHEMA);
  commitWithTrailer("Re-record: schema.json: a new stat in the schema");
  passes();
});

test("with no origin/main to compare with, it fails, saying to fetch", () => {
  git("update-ref", "-d", BASE);
  const { status, said } = check();
  expect(status).toBe(1);
  expect(said).toContain("Run git fetch origin");
});
