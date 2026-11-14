#!/usr/bin/env node
// vercel.json's ignoreCommand: skips the production build of a merge that changes nothing the release
// ships, so a docs or pipeline merge costs no build minutes (14 Nov 2026: 39 of a day's 86 merges were
// only those, about half the day's build cost). Vercel's two documented exits: 0 skips the build, 1 runs it.
// Any doubt runs it, and says why in the build log: no earlier release to compare with, a commit the
// shallow clone lacks, or git failing. #512's ignore command skipped production too; this one only
// ever skips when git lists every changed file and each is outside what ships.

import { spawnSync } from "node:child_process";
import { ranDirectly } from "./thisScript.mjs";

/** Vercel's exit codes for an ignore command. */
export const SKIP = 0;
export const BUILD = 1;
/** Vercel's variable holding the commit of the project's last successful deployment. */
export const PREVIOUS_SHA = "VERCEL_GIT_PREVIOUS_SHA";

/** Files no release ships: docs, specs, the agents' and CI's settings, tests and markdown. */
const NOT_SHIPPED = /^(docs\/|spec\/|\.claude\/|\.github\/|tests\/)|\.md$/;

/** Whether a merge changing `files` needs a release: true unless there are files and none ships. */
const needsRelease = (files) => files.length === 0 || files.some((file) => !NOT_SHIPPED.test(file));

/** The files changed since `since`, or null when git can't say. */
function changedSince(since) {
  const diff = spawnSync("git", ["diff", "--no-renames", "--name-only", since, "HEAD"], { encoding: "utf8" });
  if (diff.status !== 0) return null;
  return diff.stdout.split("\n").filter(Boolean);
}

/** The exit for this build, and the line saying why. */
export function decide(env, changed = changedSince) {
  const since = env[PREVIOUS_SHA];
  if (!since) return { exit: BUILD, why: `no ${PREVIOUS_SHA}, so nothing to compare with: building` };
  const files = changed(since);
  if (files === null) return { exit: BUILD, why: `git can't compare with ${since}: building` };
  if (needsRelease(files)) return { exit: BUILD, why: `${files.length} file(s) changed since ${since}, some shipped: building` };
  return { exit: SKIP, why: `only docs, specs, tests or settings changed since ${since}: skipping the release` };
}

if (ranDirectly(import.meta.url)) {
  const { exit, why } = decide(process.env);
  console.log(why);
  process.exit(exit);
}
