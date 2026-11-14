import { join } from "node:path";
import { expect, test } from "vitest";
import { MAKE, POLL_MS, REMOVE, STATE, WAIT_MOST_MS, liveCheckLeague } from "../../scripts/live-check-league.mjs";
import { REPO_ROOT } from "../support/scripts/repoRoot.mjs";

// The live-data check's league script (#2114) with the Convex CLI faked: `convex run` answers as
// the deployment would, from what each function returns in turn.

const CONVEX = join(REPO_ROOT, "node_modules", ".bin", "convex");
const team = (name, managerEmail, players, lineupStands = true) => ({ name, managerEmail, players, onAutoTeam: true, lineupStands });
const DRAFTING = { leagueId: "l1", draftOver: false, squadSize: 15, gameweek: 14, teams: [team("Team 1", "craig@example.com", 3, false), team("Team 2", "test@example.com", 2, false)] };
const READY = { ...DRAFTING, draftOver: true, teams: [team("Team 1", "craig@example.com", 15), team("Team 2", "test@example.com", 15)] };

/** A faked exec whose `convex run <fn>` answers with `answers[fn]`'s next value (its last once used up). */
function fakeConvex(answers) {
  const calls = [];
  const exec = async (command, args) => {
    calls.push(args);
    if (command !== CONVEX) return { code: 1, stdout: "", stderr: `no ${command}` };
    const queue = answers[args[1]];
    const answer = queue.length > 1 ? queue.shift() : queue[0];
    return { code: 0, stdout: JSON.stringify(answer), stderr: "" };
  };
  return { exec, calls };
}

async function run(command, answers, options = {}) {
  const { exec, calls } = fakeConvex(answers);
  const printed = [];
  const waits = [];
  const ok = await liveCheckLeague({ command, cwd: REPO_ROOT, exec, print: (line) => printed.push(line), wait: async (ms) => waits.push(ms), ...options });
  return { ok, printed, calls, waits };
}

test("make makes the league, waits for its draft, and reports each team ready", async () => {
  const { ok, printed, calls, waits } = await run("make", { [MAKE]: [{ made: true, leagueId: "l1" }], [STATE]: [DRAFTING, READY] }, { prod: true });
  expect(ok).toBe(true);
  expect(calls.map((args) => args[1])).toEqual([MAKE, STATE, STATE]);
  expect(calls.every((args) => args.at(-1) === "--prod")).toBe(true);
  expect(waits).toEqual([POLL_MS]);
  expect(printed[0]).toMatch(/^Made the test league on the live site/);
  expect(printed).toContain("  Team 2 (test@example.com): 15/15 players, lineup stands, auto team on");
  expect(printed.at(-1)).toBe("Ready for gameweek 14: the draft is over and both lineups stand.");
});

test("a second make finds the league and says so, making nothing", async () => {
  const { ok, printed, calls } = await run("make", { [MAKE]: [{ made: false, leagueId: "l1" }], [STATE]: [READY] });
  expect(ok).toBe(true);
  expect(calls.some((args) => args.includes("--prod"))).toBe(false);
  expect(printed[0]).toBe("The test league is already on dev: left as it is.");
});

test("a draft not over in time fails the run, saying so", async () => {
  const { ok, printed, waits } = await run("make", { [MAKE]: [{ made: true, leagueId: "l1" }], [STATE]: [DRAFTING] });
  expect(ok).toBe(false);
  expect(waits).toHaveLength(WAIT_MOST_MS / POLL_MS);
  expect(printed.at(-1)).toMatch(/the draft is still running/);
});

test("delete deletes the league, and says when there is none", async () => {
  expect((await run("delete", { [REMOVE]: [true] })).printed).toEqual(["The test league is being deleted on dev, with everything in it; no one is emailed."]);
  expect((await run("delete", { [REMOVE]: [false] })).printed).toEqual(["There is no test league on dev to delete."]);
});

test("any other command is refused before the deployment is reached", async () => {
  await expect(run("drop", {})).rejects.toThrow("usage: node scripts/live-check-league.mjs make|delete [--prod]");
});
