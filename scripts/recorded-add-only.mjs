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

import { branchCheck } from "./branchCheck.mjs";

const FOLDERS = ["tests/support/recorded/", "tests/support/golden/"];
const TRAILER = "Re-record";

const { fail, git, base: baseOf, trailerValues } = branchCheck("add-only check");
const base = baseOf();

/** Each file under FOLDERS that the branch or the working tree changes or deletes. */
const touched = git("diff", "--name-status", "--no-renames", base, "--", ...FOLDERS)
  .split("\n")
  .filter(Boolean)
  .map((line) => line.split("\t"))
  .filter(([status]) => status !== "A")
  .map(([, path]) => path);

/** The files the branch's commits say were re-recorded on purpose, with a reason. */
const allowed = new Set(
  trailerValues(TRAILER, base)
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
