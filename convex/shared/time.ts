// scripts/record-match.mjs and scripts/with-deadline.mjs load this under plain node: import only types, or other files by explicit `.ts` path.
// Units of time in milliseconds, the unit Date.now() and Convex's scheduler count in. They are
// the calendar's, not any rule's, so they are constants with one home.

export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;
