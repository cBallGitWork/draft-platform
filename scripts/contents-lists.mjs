#!/usr/bin/env node
// CLAUDE.md's rule, checked: every tracked Markdown doc over MAX_LINES lines opens with a contents
// list, a `**Contents:**` line or a `## Contents` heading within its first NEAR_TOP lines. Names
// each doc that lacks one and fails. Generated docs, which no one here writes, are skipped.
// Run from the repo: `node scripts/contents-lists.mjs`; `npm run verify` runs it, so CI does.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const MAX_LINES = 100;
/** How far down the contents list may start: past a skill's or agent's front matter and a title's
 *  opening paragraph, but still before the first section. */
export const NEAR_TOP = 30;
const CONTENTS = /^(\*\*Contents:\*\*|#{1,6} Contents\s*$)/;
/** Written by `npx convex dev`, not by us. */
const GENERATED = ["convex/_generated/"];

const lineCount = (text) => text.split("\n").length - (text.endsWith("\n") ? 1 : 0);

/** The docs, of `docs` ([path, text] pairs), over MAX_LINES lines with no contents list near the top. */
export function docsWithoutContents(docs) {
  return docs
    .filter(([path]) => !GENERATED.some((folder) => path.startsWith(folder)))
    .filter(([, text]) => lineCount(text) > MAX_LINES)
    .filter(([, text]) => !text.split("\n").slice(0, NEAR_TOP).some((line) => CONTENTS.test(line)))
    .map(([path]) => path);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tracked = execFileSync("git", ["ls-files", "-z", "*.md"], { encoding: "utf8" }).split("\0").filter(Boolean);
  const missing = docsWithoutContents(tracked.map((path) => [path, readFileSync(path, "utf8")]));
  for (const path of missing) {
    console.error(`contents lists: ${path} is over ${MAX_LINES} lines and has no contents list in its first ${NEAR_TOP}`);
  }
  if (missing.length > 0) process.exit(1);
  console.log(`contents lists: every doc over ${MAX_LINES} lines has one`);
}
