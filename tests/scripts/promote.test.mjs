// The once-a-day move up from staging to live (spec/20, S20.20; #2464): when it moves, and why not.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { KICKOFF_GAP_MINUTES, PROMOTE_HOUR, RELEASE_BRANCH, STAGING_ENVIRONMENT, decide, hourInLondon, matchOn } from "../../scripts/promote.mjs";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";

const workflow = readFileSync(join(REPO_ROOT, ".github/workflows/promote.yml"), "utf8");
const SEVEN_WINTER = new Date("2026-11-17T07:00:00Z"); // 07:00 GMT
const SEVEN_SUMMER = new Date("2026-08-17T06:00:00Z"); // 07:00 BST
const TESTED = "a".repeat(40);
const OLD = "b".repeat(40);
const ready = { now: SEVEN_WINTER, scheduled: true, candidate: TESTED, released: OLD, stagingBuilt: true, match: null };

test("it runs at 07:00 London in winter and summer, from release's branch name Vercel builds as live", () => {
  expect(PROMOTE_HOUR).toBe(7);
  expect(RELEASE_BRANCH).toBe("release");
  expect(hourInLondon(SEVEN_WINTER)).toBe(PROMOTE_HOUR);
  expect(hourInLondon(SEVEN_SUMMER)).toBe(PROMOTE_HOUR);
  // the two UTC times cover GMT and BST
  expect(workflow).toContain("cron: '0 6,7 * * *'");
});

test("a tested commit staging built, with no match on, moves up", () => {
  expect(decide(ready)).toEqual({ move: true, red: false, why: `moving live up to ${TESTED.slice(0, 7)}` });
});

test("a timed run at the wrong London hour waits; one by hand doesn't", () => {
  const sixInWinter = new Date("2026-11-17T06:00:00Z");
  expect(decide({ ...ready, now: sixInWinter })).toMatchObject({ move: false, red: false });
  expect(decide({ ...ready, now: sixInWinter, scheduled: false }).move).toBe(true);
});

test("no nightly pass, or a failed staging build, waits and turns red", () => {
  expect(decide({ ...ready, candidate: null })).toMatchObject({ move: false, red: true });
  expect(decide({ ...ready, stagingBuilt: false })).toMatchObject({ move: false, red: true });
});

test("live already on the tested commit, or a match on, waits quietly", () => {
  expect(decide({ ...ready, released: TESTED })).toMatchObject({ move: false, red: false });
  expect(decide({ ...ready, match: "a match is on" })).toMatchObject({ move: false, red: false, why: "a match is on" });
});

test("a match is on while started and not finished, or kicking off within the gap", () => {
  const now = SEVEN_WINTER;
  const at = (minutes) => new Date(now.getTime() + minutes * 60_000).toISOString();
  expect(matchOn([{ id: 1, started: true, finished_provisional: false, finished: false, kickoff_time: at(-30) }], now)).toContain("fixture 1");
  expect(matchOn([{ id: 2, started: true, finished_provisional: true, finished: false, kickoff_time: at(-120) }], now)).toBeNull();
  expect(matchOn([{ id: 3, started: false, kickoff_time: at(KICKOFF_GAP_MINUTES - 1) }], now)).toContain("fixture 3");
  expect(matchOn([{ id: 4, started: false, kickoff_time: at(KICKOFF_GAP_MINUTES + 1) }], now)).toBeNull();
  expect(matchOn([{ id: 5, started: false, kickoff_time: null }], now)).toBeNull();
});

test("staging is Vercel's preview environment", () => {
  expect(STAGING_ENVIRONMENT.test("Preview")).toBe(true);
  expect(STAGING_ENVIRONMENT.test("Preview – draft-platform")).toBe(true);
  expect(STAGING_ENVIRONMENT.test("Production")).toBe(false);
});
