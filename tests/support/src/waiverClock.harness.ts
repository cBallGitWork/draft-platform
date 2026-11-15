// A waiver clock as convex/waivers/waiverClock.ts's `clockOf` sends it (#2008), for the live seams'
// tests: Wednesday 13 January 2027 at noon, winter, so UK time is UTC; the league runs waivers on
// Thursday at 18:00, after gameweek 12's deadline that morning.

import type { HeldWaiverClock, RunAhead } from "../../../convex/waivers/runsAhead";

/** The hour the screen asks for, and its minute: Wednesday at noon. */
export const WEDNESDAY_NOON = Date.UTC(2027, 0, 13, 12, 0);

export const GAMEWEEK_12_CLOCK: HeldWaiverClock = {
  runs: [{ day: "thursday", hour: 18, minute: 0 }],
  gameweeks: [{ gameweek: 12, deadline: Date.UTC(2027, 0, 14, 10, 0) }],
  underWay: [],
};

/** The run that can first take a player claimable from before Wednesday noon: Thursday's, after
 *  gameweek 12's deadline, so it may be skipped. */
export const THURSDAYS_RUN: RunAhead = { at: Date.UTC(2027, 0, 14, 18, 0), skippedIf: 12 };
