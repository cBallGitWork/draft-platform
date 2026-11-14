// The first live-data check's test league (spec/20, The first live-data check, S20.12; #2114):
// makes it before the round's deadline, and deletes it once the check passes. Two teams, Craig's
// and the test account's, drafted by auto-pick and each lineup set by the auto team
// (convex/leagues/liveCheckLeague.ts). Safe to run twice: a second `make` finds the league and
// says so. The test account must be set up on the deployment first (docs/setup.md).
//
//   node scripts/live-check-league.mjs make --prod     (the live site; without --prod, dev)
//   node scripts/live-check-league.mjs delete --prod

import { parseArgs } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";
import { bin, captured, cli } from "./live-setup/tools.mjs";
import { LIVE_SITE_URL } from "./live-site.mjs";
import { CHECKOUT, ranDirectly } from "./thisScript.mjs";

const MODULE = "leagues/liveCheckLeague";
export const MAKE = `${MODULE}:make`;
export const STATE = `${MODULE}:state`;
export const REMOVE = `${MODULE}:remove`;
const COMMANDS =["make", "delete"];

/** How often the draft is looked at while it runs itself: a pick every 10 seconds. */
export const POLL_MS = 15_000;
/** How long the draft is waited for: two teams' picks, 10 seconds apart, take a few minutes. */
export const WAIT_MOST_MS = 30 * 60_000;

/** One line a team: its manager, its players against the squad size, and its lineup. */
const teamLine = (team, squadSize) =>
  `  ${team.name} (${team.managerEmail ?? "no manager"}): ${team.players}/${squadSize ?? "?"} players, ` +
  `lineup ${team.lineupStands ? "stands" : "doesn't stand"}, auto team ${team.onAutoTeam ? "on" : "off"}`;

/** Whether the league is ready for the check: its draft over, every squad full, every lineup standing. */
const ready =(state) =>
  state !== null && state.draftOver && state.teams.length > 0 && state.teams.every((team) => team.players === state.squadSize && team.lineupStands);

/** Runs `command` ("make" or "delete") against the deployment the checkout at `cwd` points at (the
 *  live one with `prod`). Whether it ended as it should. `exec`, `print` and `wait` are swapped in tests. */
export async function liveCheckLeague({ command, prod = false, cwd = CHECKOUT, exec = captured, print = console.log, wait = sleep }) {
  if (!COMMANDS.includes(command)) throw new Error(`usage: node scripts/live-check-league.mjs ${COMMANDS.join("|")} [--prod]`);
  const convex = bin(cwd, "convex");
  const where = prod ? `the live site (${LIVE_SITE_URL})` : "dev";
  const call = async (fn) => JSON.parse(await cli(exec, "convex", convex, ["run", fn, "{}", ...(prod ? ["--prod"] : [])], { cwd }));

  if (command === "delete") {
    const deleted = await call(REMOVE);
    print(deleted ? `The test league is being deleted on ${where}, with everything in it; no one is emailed.` : `There is no test league on ${where} to delete.`);
    return true;
  }

  const { made } = await call(MAKE);
  print(made ? `Made the test league on ${where}; its draft runs itself.` : `The test league is already on ${where}: left as it is.`);
  let state = await call(STATE);
  for (let waited = 0; !ready(state) && waited < WAIT_MOST_MS; waited += POLL_MS) {
    await wait(POLL_MS);
    state = await call(STATE);
  }
  if (state === null) throw new Error(`The test league isn't on ${where} after making it`);
  for (const team of state.teams) print(teamLine(team, state.squadSize));
  if (ready(state)) {
    print(`Ready for gameweek ${state.gameweek ?? "?"}: the draft is over and both lineups stand.`);
    return true;
  }
  print(`Not ready after ${WAIT_MOST_MS / 60_000} minutes: ${state.draftOver ? "the draft is over" : "the draft is still running"}. Run it again to look.`);
  return false;
}

if (ranDirectly(import.meta.url)) {
  try {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { prod: { type: "boolean", default: false } } });
    process.exitCode = (await liveCheckLeague({ command: positionals[0], prod: values.prod })) ? 0 : 1;
  } catch (error) {
    console.error(`live-check-league: ${error.message}`);
    process.exit(1);
  }
}
