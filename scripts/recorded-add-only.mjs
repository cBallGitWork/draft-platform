#!/usr/bin/env node
// Recorded feed payloads are add-only (Craig, 22 Oct 2026): a test that passes against a payload
// someone edited proves nothing about the feed. Fails when a file under tests/support/recorded/ is
// changed or deleted (a rename counts as a deletion) between origin/main and the working tree,
// committed or not, unless a commit on the branch carries the trailer
//     Re-record: <file>: <why>
// naming that file (by its path, or its name inside the folder) and saying why. New files pass.
// Run from the repo: `node scripts/recorded-add-only.mjs`; `npm run verify` runs it, so CI does.

import { execFileSync } from "node:child_process";

const FOLDER = "tests/support/recorded/";
const BASE = "origin/main";
const TRAILER = "Re-record";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

function fail(message) {
  console.error(`recorded payloads: ${message}`);
  process.exit(1);
}

let base;
try {
  base = git("merge-base", BASE, "HEAD").trim();
} catch {
  fail(`can't find where this branch left ${BASE}. Run git fetch origin, then try again.`);
}

/** Each file under FOLDER that the branch or the working tree changes or deletes. */
const touched = git("diff", "--name-status", "--no-renames", base, "--", FOLDER)
  .split("\n")
  .filter(Boolean)
  .map((line) => line.split("\t"))
  .filter(([status]) => status !== "A")
  .map(([, path]) => path);

/** The files the branch's commits say were re-recorded on purpose, with a reason. */
const allowed = new Set(
  git("log", `--format=%(trailers:key=${TRAILER},valueonly,separator=%x0A)`, `${base}..HEAD`)
    .split("\n")
    .map((value) => value.match(/^\s*(\S+?):\s*\S/)?.[1])
    .filter(Boolean)
    .flatMap((file) => [file, FOLDER + file]),
);

const refused = touched.filter((path) => !allowed.has(path));
if (refused.length) {
  fail(
    `they are add-only, but this branch changes or deletes ${refused.join(", ")}. Record a new ` +
      `file beside the old one, or, if the old one was wrong, add a trailer to a commit on this branch: ` +
      `"${TRAILER}: <file>: <why>".`,
  );
}
