#!/usr/bin/env node
// Recorded feed payloads and the goldens are add-only (Craig, 22 Oct 2026): a test that passes
// against a payload someone edited proves nothing about the feed, and a failing test "fixed" by
// editing its expected answer proves nothing at all. Fails when a file under FOLDERS is changed or
// deleted (a rename counts as a deletion) between origin/main and the working tree, committed or
// not, unless a commit on the branch carries the trailer
//     Re-record: <file>: <why>
// naming that file (by its path, or its name inside its folder) and saying why. A legitimate
// change, such as a new golden schema.json, carries one. New files pass.
// Run from the repo: `node scripts/recorded-add-only.mjs`; `npm run verify` runs it, so CI does.

import { execFileSync } from "node:child_process";

const FOLDERS = ["tests/support/recorded/", "tests/support/golden/"];
const BASE = "origin/main";
const TRAILER = "Re-record";

function fail(message) {
  console.error(`add-only check: ${message}`);
  process.exit(1);
}

/** git's output; a git failure ends the check with what it said, not a stack trace. */
function git(...args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const said = String(error.stderr ?? "").trim() || error.message;
    fail(`git ${args[0]} failed (${said}). Run git fetch origin, then try again.`);
  }
}

const base = git("merge-base", BASE, "HEAD").trim();

/** Each file under FOLDERS that the branch or the working tree changes or deletes. */
const touched = git("diff", "--name-status", "--no-renames", base, "--", ...FOLDERS)
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
    .filter(Boolean),
);
const isAllowed = (path) =>
  allowed.has(path) || FOLDERS.some((folder) => path.startsWith(folder) && allowed.has(path.slice(folder.length)));

const refused = touched.filter((path) => !isAllowed(path));
if (refused.length) {
  fail(
    `${FOLDERS.join(" and ")} are add-only, but this branch changes or deletes ${refused.join(", ")}. ` +
      `Add a new file beside the old one, or, if the old one was wrong, add a trailer to a commit on ` +
      `this branch: "${TRAILER}: <file>: <why>".`,
  );
}
