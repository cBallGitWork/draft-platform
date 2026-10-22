// scripts/record-match.mjs loads this under plain node: import only types, or other files by explicit `.ts` path.
// Units of time in milliseconds, the unit Date.now() and Convex's scheduler count in. They are
// the calendar's, not any rule's, so they are constants with one home.

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;
