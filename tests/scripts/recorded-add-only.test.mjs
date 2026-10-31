// scripts/recorded-add-only.mjs, the add-only check on recorded feed payloads and goldens that
// `npm run verify` runs: in a scratch repo whose origin/main holds two payloads and a golden, adding
// one passes; changing, deleting or renaming one fails, committed or not, unless a branch commit
// carries "Re-record: <file>: <why>" for it.

import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";
import { scratchRepo } from "../support/scripts/gitRepo.harness.mjs";

const SCRIPT = join(REPO_ROOT, "scripts/recorded-add-only.mjs");
const RECORDED = "tests/support/recorded";
const PAYLOAD_A = `${RECORDED}/a.json`;
const PAYLOAD_B = `${RECORDED}/b.json`;
const GOLDEN_SCHEMA = "tests/support/golden/schema.json";

let repo;

/** The line a branch commit carries to re-record `file` on purpose. */
const reRecord = (file, why) => `Re-record: ${file}: ${why}`;

const editPayloadA = () => repo.write(PAYLOAD_A, '{"a":2}\n');

/** a.json edited in a commit on the branch, with no trailer yet. */
function commitEditToPayloadA() {
  editPayloadA();
  repo.commitAll("edit a");
}

const check = () => repo.run(SCRIPT);

const passes = () => expect(check()).toEqual({ status: 0, said: "" });

/** The check fails, naming `path` as the file it refused. */
function refuses(path) {
  const { status, said } = check();
  expect(status).toBe(1);
  expect(said).toContain(`changes or deletes ${path}`);
}

// A repo of its own per test, on a branch off an origin/main holding a.json, b.json and the golden
// schema.json.
beforeEach(() => {
  repo = scratchRepo("recorded-add-only-");
  repo.write(PAYLOAD_A, '{"a":1}\n');
  repo.write(PAYLOAD_B, '{"b":1}\n');
  repo.write(GOLDEN_SCHEMA, '{"v":1}\n');
  repo.commitAll("base");
  repo.branchOffOriginMain();
});

afterEach(() => repo.remove());

test("nothing changed passes", () => {
  passes();
});

test("a new payload passes, before and after it's committed", () => {
  repo.write(`${RECORDED}/c.json`, '{"c":1}\n');
  passes();
  repo.commitAll("add c");
  passes();
});

test("a file changed outside the two folders passes", () => {
  repo.write("other.txt", "x\n");
  repo.commitAll("other");
  passes();
});

test("a changed payload fails, before and after it's committed", () => {
  editPayloadA();
  refuses(PAYLOAD_A);
  repo.commitAll("edit a");
  refuses(PAYLOAD_A);
});

test("a trailer naming another file doesn't let the change through", () => {
  commitEditToPayloadA();
  repo.commitWithTrailer(reRecord("b.json", "the feed changed"));
  refuses(PAYLOAD_A);
});

test("a trailer with no reason doesn't let the change through", () => {
  commitEditToPayloadA();
  repo.commitWithTrailer(reRecord("a.json", ""));
  refuses(PAYLOAD_A);
});

test("Re-record in the commit's subject, not as a trailer, doesn't let the change through", () => {
  commitEditToPayloadA();
  repo.git("commit", "-q", "--allow-empty", "-m", reRecord("a.json", "in the subject, not a trailer"));
  refuses(PAYLOAD_A);
});

test("a trailer naming the file by its name in its folder, with a reason, lets the change through", () => {
  commitEditToPayloadA();
  repo.commitWithTrailer(reRecord("a.json", "FPL renamed a key"));
  passes();
});

test("a deleted payload fails until a trailer names it by its path", () => {
  repo.git("rm", "-q", PAYLOAD_B);
  repo.commitAll("drop b");
  refuses(PAYLOAD_B);
  repo.commitWithTrailer(reRecord(PAYLOAD_B, "cut down"));
  passes();
});

test("a renamed payload fails, as the old file's deletion", () => {
  repo.git("mv", PAYLOAD_A, `${RECORDED}/a2.json`);
  repo.commitAll("rename a");
  refuses(PAYLOAD_A);
});

test("an edited golden fails until a trailer names it", () => {
  repo.write(GOLDEN_SCHEMA, '{"v":2}\n');
  repo.commitAll("edit golden");
  refuses(GOLDEN_SCHEMA);
  repo.commitWithTrailer(reRecord("schema.json", "a new stat in the schema"));
  passes();
});

test("with no origin/main to compare with, it fails, saying to fetch", () => {
  repo.dropOriginMain();
  const { status, said } = check();
  expect(status).toBe(1);
  expect(said).toContain("Run git fetch origin");
});
