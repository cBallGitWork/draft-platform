// The values scoring reads and checks: points in tenths, a stat from a match record, the refusal
// a bad value gets, and the double-gameweek rules a league picks from. It imports nothing, so
// scoringSet.ts, ruleChecks.ts, ownStats.ts and scoring.ts can all lean on it without leaning on
// each other in a circle (#198), and a league's rules shape can name the double-gameweek rules
// without loading the scorer (#756).

/** Why a scoring set can't be saved or scored with, told apart from a bug, which is never shown
 *  as a reason. Every check in scoringSet.ts, ruleChecks.ts, ownStats.ts and here throws it. */
export class UnsoundScoring extends Error {}

/** A player's stats for one match, by the feeds' own keys. */
export type MatchStats = Readonly<Record<string, number>>;

/** Points to the nearest tenth, which is all they are kept in: floating point's own noise goes.
 *  Never -0, which JavaScript makes of 0 yellow cards at -1, or of tenths that cancel out (0.3,
 *  -0.1 and -0.2 add to just under 0), and which a saved row or a test tells apart from 0 (#422). */
export function inTenths(points: number): number {
  const rounded = Math.round(points * 10) / 10;
  return rounded === 0 ? 0 : rounded;
}

/** Throws "<what> <value>, not a number" unless it is a finite number, never coerced from text. */
export function requireNumber(value: unknown, what: string): asserts value is number {
  if (!Number.isFinite(value)) throw new UnsoundScoring(`${what} ${showValue(value)}, not a number`);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A bad value as the reason shows it: NaN and undefined by name, text in quotes. */
export function showValue(value: unknown): string {
  return typeof value === "number" || value === undefined ? String(value) : JSON.stringify(value);
}

/** Only the record's own keys count: a rule on `constructor` must not read Object's. A stat the
 *  feeds sent as anything but a number is bad data, never 0. */
export function statIn(record: MatchStats, stat: string): number {
  if (!Object.hasOwn(record, stat)) return 0;
  const actions = record[stat];
  requireNumber(actions, `his record's ${stat} is`);
  return actions;
}

/** A league's double-gameweek rule (spec/03): both matches count, or only his best match. */
export const DOUBLE_GAMEWEEK_RULES = ["bothMatches", "bestMatch"] as const;
export type DoubleGameweekRule = (typeof DOUBLE_GAMEWEEK_RULES)[number];
