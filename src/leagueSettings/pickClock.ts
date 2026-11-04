// The pick clock as League settings edits it (#1087): the rules hold whole seconds, from 15 seconds
// to 24 hours (convex/draft/draftLimits.ts), and the screen shows them in a unit the commissioner
// chooses, so a slow draft's 8 hours isn't typed as 28800 seconds.

export const PICK_CLOCK_UNITS = ["seconds", "minutes", "hours"] as const;
export type PickClockUnit = (typeof PICK_CLOCK_UNITS)[number];

const SECONDS_IN: Record<PickClockUnit, number> = { seconds: 1, minutes: 60, hours: 3600 };

/** The largest unit `seconds` is a whole number of; seconds for a clock with no number. */
export const unitFor = (seconds: number): PickClockUnit => PICK_CLOCK_UNITS.findLast((unit) => seconds % SECONDS_IN[unit] === 0) ?? "seconds";

/** `seconds` in `unit`: 90 seconds is 1.5 minutes. NaN, a box left without a number, stays NaN. */
export const inUnit = (seconds: number, unit: PickClockUnit) => seconds / SECONDS_IN[unit];

/** How finely a clock typed in a unit is kept in seconds: to a millionth. */
const ROUNDED_TO = 1e6;

/** So many of `unit` in seconds, rounded off past a millionth so 0.1 hours is 360 seconds, never
 *  360.00000000000006. NaN stays NaN. */
export const toSeconds = (amount: number, unit: PickClockUnit) => Math.round(amount * SECONDS_IN[unit] * ROUNDED_TO) / ROUNDED_TO;
