#!/usr/bin/env node
// The once-a-day move up to live (spec/20, S20.20; #2464): `promote.yml` runs this at 07:00 UK
// time. It moves the `release` branch, which Vercel builds as the live site, up to the commit of
// `main` that the night's full test run passed on (verify.yml on main: its nightly run, or the lead's backstop run of it), but only when staging's
// newest build at or before that commit succeeded (Vercel's preview of `main`, on the development
// deployment, S20.19; a merge that ships nothing builds nothing, so the newest build at or before it
// holds the same code) and no Premier League match is on or kicks off within the hour. A day it
// can't, it says why and waits for the next: a failed night or a failed staging build turns the run
// red, so GitHub emails Craig; a match on, or live already there, doesn't.
//
// Needs GITHUB_TOKEN (contents: write, to push `release`) and GITHUB_REPOSITORY, both from Actions.
// `--dry-run` decides and says so, but pushes nothing. BACK_TO (the workflow's `back_to`, by hand
// only) puts live straight back on an earlier commit of `main`, with no test or match check: the
// way to undo a bad release at once, since a revert merged to `main` waits for the night's run.

import { spawnSync } from "node:child_process";
import { FPL_FIXTURES_URL } from "../convex/football/football.ts";
import { LONDON_ZONE, LOCALE } from "../convex/shared/moments.ts";
import { STAGING_BRANCH } from "./release.mjs";
import { ranDirectly } from "./thisScript.mjs";

/** The branch Vercel builds as the live site (spec/20). Staging builds from STAGING_BRANCH. */
export const RELEASE_BRANCH = "release";
/** The London hour the move up runs at (S20.20); the workflow's two UTC times cover summer and winter. */
export const PROMOTE_HOUR = 7;
/** How long before a kick-off the move up holds off. */
export const KICKOFF_GAP_MINUTES = 60;
/** Vercel names a preview deployment's GitHub environment "Preview", sometimes with the project after it. */
export const STAGING_ENVIRONMENT = /^Preview\b/;
/** The full test run, nightly on main (verify.yml's schedule), and how fresh its pass must be. */
const NIGHTLY_WORKFLOW = "verify.yml";
const NIGHTLY_MAX_AGE_HOURS = 30; // GitHub starts the 03:30 run hours late (11:53 UTC on 16 Nov 2026)
const HOUR_MS = 3_600_000;

const MINUTE_MS = 60_000;
const londonHour = new Intl.DateTimeFormat(LOCALE, { timeZone: LONDON_ZONE, hour: "numeric", hourCycle: "h23" });

/** The London hour of `now`. */
export const hourInLondon = (now) => Number(londonHour.format(now));

/** A match on, or one kicking off within the gap, from FPL's fixtures; null when none is. */
export function matchOn(fixtures, now) {
  const soon = now.getTime() + KICKOFF_GAP_MINUTES * MINUTE_MS;
  for (const fixture of fixtures) {
    if (fixture.started && !fixture.finished_provisional && !fixture.finished) return `a match is on (fixture ${fixture.id})`;
    const kickoff = fixture.kickoff_time ? Date.parse(fixture.kickoff_time) : NaN;
    if (!fixture.started && kickoff >= now.getTime() && kickoff <= soon) {
      return `a match kicks off within ${KICKOFF_GAP_MINUTES} minutes (fixture ${fixture.id})`;
    }
  }
  return null;
}

/**
 * Whether to move `release` up to `candidate`, and why not when it mustn't. Every input is read
 * before this, so the decision itself is pure. `red` marks a reason Craig should hear about.
 * - `scheduled`: a timed run, which only moves at PROMOTE_HOUR London; a run by hand moves any time.
 * - `candidate`: the commit the newest nightly pass ran on, null when none passed in the last day.
 * - `released`: the commit `release` is on now.
 * - `stagingBuilt`: staging's newest build at or before `candidate` succeeded.
 * - `match`: matchOn's answer, or the reason the fixtures couldn't be read.
 */
export function decide({ now, scheduled, candidate, released, stagingBuilt, match }) {
  if (scheduled && hourInLondon(now) !== PROMOTE_HOUR) return { move: false, red: false, why: `it isn't ${PROMOTE_HOUR}:00 in London` };
  if (!candidate) return { move: false, red: true, why: `the full test run hasn't passed on ${STAGING_BRANCH} in the last ${NIGHTLY_MAX_AGE_HOURS} hours` };
  const short = candidate.slice(0, 7);
  if (candidate === released) return { move: false, red: false, why: `live is already on ${short}, the last tested commit` };
  if (!stagingBuilt) return { move: false, red: true, why: `staging's newest build at or before ${short} didn't succeed` };
  if (match) return { move: false, red: false, why: match };
  return { move: true, red: false, why: `moving live up to ${short}` };
}

/** `gh api <path>`'s first page, parsed, as a list of pages so either shape reads the same. */
function ghApi(path) {
  const run = spawnSync("gh", ["api", path], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0) throw new Error(`gh api ${path}: ${run.stderr.trim() || `exit ${run.status}`}`);
  return [JSON.parse(run.stdout)].flat();
}

const branchHead = (repo, branch) => {
  const run = spawnSync("gh", ["api", `repos/${repo}/branches/${branch}`, "--jq", ".commit.sha"], { encoding: "utf8" });
  return run.status === 0 ? run.stdout.trim() : null;
};

/** The commit the newest nightly pass on main ran on, if it finished within the last day. */
function nightlyPass(repo, now) {
  const [run] = ghApi(`repos/${repo}/actions/workflows/${NIGHTLY_WORKFLOW}/runs?branch=${STAGING_BRANCH}&status=success&per_page=1`)
    .flatMap((page) => page.workflow_runs ?? []);
  if (!run) return null;
  const age = now.getTime() - Date.parse(run.updated_at);
  return age <= NIGHTLY_MAX_AGE_HOURS * HOUR_MS ? run.head_sha : null;
}

/** Whether `sha` is `base` or comes after it on its branch. */
function atOrAfter(repo, base, sha) {
  const run = spawnSync("gh", ["api", `repos/${repo}/compare/${base}...${sha}`, "--jq", ".status"], { encoding: "utf8" });
  return run.status === 0 && ["identical", "ahead"].includes(run.stdout.trim());
}

/** Whether staging's newest build at or before `sha` succeeded. */
function stagingBuilt(repo, sha) {
  for (const deployment of ghApi(`repos/${repo}/deployments?ref=${STAGING_BRANCH}&per_page=30`)) {
    if (!STAGING_ENVIRONMENT.test(deployment.environment ?? "")) continue;
    if (!atOrAfter(repo, deployment.sha, sha)) continue;
    const [latest] = ghApi(`repos/${repo}/deployments/${deployment.id}/statuses?per_page=1`);
    return latest?.state === "success";
  }
  return false;
}

async function readMatch(now) {
  try {
    const response = await fetch(FPL_FIXTURES_URL);
    if (!response.ok) return `FPL's fixtures couldn't be read (HTTP ${response.status}), so not moving, to be safe`;
    return matchOn(await response.json(), now);
  } catch (error) {
    return `FPL's fixtures couldn't be read (${error.message}), so not moving, to be safe`;
  }
}

/** Puts `release` back on `sha`, an earlier commit of main. */
function backTo(repo, sha, dryRun) {
  if (!/^[0-9a-f]{7,40}$/.test(sha) || !atOrAfter(repo, sha, STAGING_BRANCH)) {
    console.log(`Not moving: ${sha} isn't a commit on ${STAGING_BRANCH}.`);
    return 1;
  }
  console.log(`Putting live back on ${sha.slice(0, 7)}${dryRun ? " (dry run: nothing pushed)" : ""}.`);
  if (dryRun) return 0;
  const push = spawnSync("git", ["push", "--force", "origin", `${sha}:refs/heads/${RELEASE_BRANCH}`], { stdio: "inherit" });
  return push.status ?? 1;
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const dryRun = process.argv.includes("--dry-run");
  if (process.env.BACK_TO) return backTo(repo, process.env.BACK_TO.trim(), dryRun);
  const scheduled = process.env.GITHUB_EVENT_NAME === "schedule";
  const now = new Date();
  const candidate = nightlyPass(repo, now);
  const decision = decide({
    now,
    scheduled,
    candidate,
    released: branchHead(repo, RELEASE_BRANCH),
    stagingBuilt: candidate ? stagingBuilt(repo, candidate) : false,
    match: await readMatch(now),
  });
  console.log(`${decision.move ? "Move up" : "Not today"}: ${decision.why}.`);
  if (!decision.move) return decision.red ? 1 : 0;
  if (dryRun) return 0;
  const push = spawnSync("git", ["push", "origin", `${candidate}:refs/heads/${RELEASE_BRANCH}`], { stdio: "inherit" });
  return push.status ?? 1;
}

if (ranDirectly(import.meta.url)) process.exit(await main());
