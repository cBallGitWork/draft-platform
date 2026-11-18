// The once-a-day move up from staging to live (spec/20, S20.20; #2464): when it moves, and why not.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { BROKEN, BUILDING, BUILT, KICKOFF_GAP_MINUTES, PROMOTE_HOUR, PROMOTE_UNTIL_HOUR, RELEASE_BRANCH, STAGING_ENVIRONMENT, decide, ghApi, hourInLondon, matchOn, nightlyPass, sameLondonDay, stagingState } from "../../scripts/promote.mjs";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";

const workflow = readFileSync(join(REPO_ROOT, ".github/workflows/promote.yml"), "utf8");
const SEVEN_WINTER = new Date("2026-11-17T07:00:00Z"); // 07:00 GMT
const SEVEN_SUMMER = new Date("2026-08-17T06:00:00Z"); // 07:00 BST
const TESTED = "a".repeat(40);
const OLD = "b".repeat(40);
const YESTERDAY = new Date("2026-11-16T07:00:00Z");
const ready = { now: SEVEN_WINTER, scheduled: true, lastMoved: YESTERDAY, candidate: TESTED, released: OLD, staging: BUILT, match: null };

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

test("a timed run outside 07:00 to 12:00 London waits; one by hand doesn't", () => {
  const sixInWinter = new Date("2026-11-17T06:00:00Z");
  expect(decide({ ...ready, now: sixInWinter })).toMatchObject({ move: false, red: false });
  expect(decide({ ...ready, now: sixInWinter, scheduled: false }).move).toBe(true);
  expect(PROMOTE_UNTIL_HOUR).toBe(12);
  expect(decide({ ...ready, now: new Date("2026-11-17T12:00:00Z") }).move).toBe(false);
});

test("GitHub starting the run late still moves, but only once a London day", () => {
  const late = new Date("2026-11-17T09:40:00Z");
  expect(decide({ ...ready, now: late }).move).toBe(true);
  // summer's second run, an hour after the first moved
  const movedThisMorning = new Date("2026-08-17T06:00:30Z");
  expect(sameLondonDay(movedThisMorning, new Date("2026-08-17T07:00:00Z"))).toBe(true);
  expect(decide({ ...ready, now: new Date("2026-08-17T07:00:00Z"), lastMoved: movedThisMorning })).toMatchObject({ move: false, red: false, why: "live already moved today" });
  // by hand, it moves again the same day
  expect(decide({ ...ready, lastMoved: SEVEN_WINTER, scheduled: false }).move).toBe(true);
});

test("no nightly pass, or a failed staging build, waits and turns red", () => {
  expect(decide({ ...ready, candidate: null })).toMatchObject({ move: false, red: true });
  expect(decide({ ...ready, staging: BROKEN })).toMatchObject({ move: false, red: true });
});

test("a staging build still running waits quietly", () => {
  expect(decide({ ...ready, staging: BUILDING })).toMatchObject({ move: false, red: false });
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

/** A stand-in for `gh api`: answers each call from the first route whose text the path holds, and throws as ghApi does for one it has none for. */
const github = (routes) => (path) => {
  const route = Object.keys(routes).find((part) => path.includes(part));
  if (!route) throw new Error(`gh api ${path} failed: HTTP 502`);
  return [routes[route]].flat();
};
const REPO = "owner/repo";
const LATER = "c".repeat(40);
const runs = (...workflow_runs) => ({ workflow_runs });

test("the candidate is the newest full test pass on main, only while it is under 30 hours old (S20.20)", () => {
  const passed = (hoursAgo) => github({ "actions/workflows": runs({ head_sha: TESTED, updated_at: new Date(SEVEN_WINTER.getTime() - hoursAgo * 3_600_000).toISOString() }) });
  expect(nightlyPass(REPO, SEVEN_WINTER, passed(4))).toBe(TESTED);
  expect(nightlyPass(REPO, SEVEN_WINTER, passed(31))).toBeNull();
  expect(nightlyPass(REPO, SEVEN_WINTER, github({ "actions/workflows": runs() }))).toBeNull();
});

test("staging's newest build at or before the candidate decides: built, still building, or broken (S20.20)", () => {
  const staging = (state, environment = "Preview") => github({
    "/deployments?": [{ id: 1, sha: OLD, environment: "Production" }, { id: 2, sha: OLD, environment }],
    compare: { status: "ahead" },
    "/statuses": state ? [{ state }] : [],
  });
  expect(stagingState(REPO, TESTED, staging("success"))).toBe(BUILT);
  for (const state of ["pending", "queued", "in_progress", null]) expect(stagingState(REPO, TESTED, staging(state))).toBe(BUILDING);
  for (const state of ["failure", "error"]) expect(stagingState(REPO, TESTED, staging(state))).toBe(BROKEN);
  // no preview build among the newest deployments
  expect(stagingState(REPO, TESTED, staging("success", "Production"))).toBe(BROKEN);
});

test("a build after the candidate is passed over for the one at or before it (S20.20)", () => {
  const gh = github({
    "/deployments?": [{ id: 9, sha: LATER, environment: "Preview" }, { id: 2, sha: OLD, environment: "Preview" }],
    [`compare/${LATER}`]: { status: "behind" },
    [`compare/${OLD}`]: { status: "ahead" },
    "/deployments/9/statuses": [{ state: "failure" }],
    "/deployments/2/statuses": [{ state: "success" }],
  });
  expect(stagingState(REPO, TESTED, gh)).toBe(BUILT);
});

test("a failed gh call stops the run naming the call, never reading as no pass or a failed staging build (S20.20)", () => {
  const failed = () => ({ status: 1, stdout: "", stderr: "HTTP 502: Bad Gateway" });
  expect(() => ghApi("repos/owner/repo/branches/release", failed)).toThrow("gh api repos/owner/repo/branches/release failed: HTTP 502: Bad Gateway");
  expect(ghApi("any", () => ({ status: 0, stdout: "[1,2]", stderr: "" }))).toEqual([1, 2]);
  expect(() => nightlyPass(REPO, SEVEN_WINTER, github({}))).toThrow(/actions\/workflows.*failed/);
  // the compare call failing part-way through the staging search
  expect(() => stagingState(REPO, TESTED, github({ "/deployments?": [{ id: 2, sha: OLD, environment: "Preview" }] }))).toThrow(/compare.*failed/);
});
