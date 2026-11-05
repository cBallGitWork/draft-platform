// What the draft room says (spec/04, The draft room; the approved draft room pictures,
// docs/design/approved/draft-room/), in one place for Craig to change in the pull request.

import { DAY_MS, HOUR_MS, MINUTE_MS, SECOND_MS } from "../../convex/shared/time";

/** The page's title, its menu tab's too, and the state beside it. */
export const DRAFT_TITLE = "Draft";
export const stateWords = { waiting: "Not started", live: "Live", paused: "Paused", over: "Over" } as const;
export const loadingWords = "Loading the draft…";

/** The header's heads and readings, before the start. */
export const draftOrderHead = "Draft order";
/** How the order was set and when isn't held yet (#1098), so its reading is a placeholder. */
export const draftOrderPlaceholder = "How the order was set: not held yet";
export const youPickHead = "You pick";
export const clockHead = "Clock";
export const startsHead = (at: string | null) => (at === null ? "Starts" : `Starts ${at}`);
export const noStartWords = "When the commissioner starts it";
export const noClockWords = "No pick time set";

/** "1st", "2nd", "13th". */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}
/** Where a team picks in the first two rounds: "8th, then 13th". */
export const youPickWords = (first: number, second: number | null) => (second === null ? ordinal(first) : `${ordinal(first)}, then ${ordinal(second)}`);

/** A pick time, short: "90s", "2m", "8h". */
export function pickTimeWords(seconds: number): string {
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}
export const aPickWords = (seconds: number) => `${pickTimeWords(seconds)} a pick`;

/** Time left, as a clock counts it: "0:48" under an hour, then "5h 12m", then "1d 4h". */
export function timeLeftWords(left: number): string {
  const ms = Math.max(0, left);
  if (ms < HOUR_MS) {
    const seconds = Math.ceil(ms / SECOND_MS);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${Math.floor((ms % HOUR_MS) / MINUTE_MS)}m`;
}
export const inWords = (left: number) => `in ${timeLeftWords(left)}`;

/** The header's heads and readings, while the draft runs. */
export const pickOfHead = (pick: number, picks: number) => `Pick ${pick} of ${picks}`;
export const roundPickWords = (round: number, pickInRound: number) => `Round ${round}, pick ${pickInRound}`;
export const onTheClockHead = "On the clock";
export const yourTeamWords = (name: string) => `${name}, you`;
export const clockAPickHead = (seconds: number) => `${clockHead}, ${aPickWords(seconds)}`;
export const nextHead = "Next";
export const nextWords = (names: readonly string[]) => names.join(", then ");
export const yourNextHead = (onTheClock: boolean) => (onTheClock ? "Your next after this" : "Your next pick");
export const inPicksWords = (picks: number) => (picks === 1 ? "in 1 pick" : `in ${picks} picks`);

/** The board. */
export const BOARD_TITLE = "Board";
export const roundsShownWords = (first: number, last: number, rounds: number) => `Rounds ${first} to ${last} of ${rounds}`;
export const theOrderRoundsWords = (first: number, last: number, rounds: number) => `The order, rounds ${first} to ${last} of ${rounds}`;
export const wholeBoardWords = "Whole board";
export const roundHead = { short: "Rd", long: "Round" };
/** Which way a round runs, for screen readers: the snake turns each round. */
export const roundWayLabel = (leftToRight: boolean) => (leftToRight ? "runs left to right" : "runs right to left");
/** A pick's slot, as the board writes it: round 4's 3rd pick is "4.03". */
export const slotWords = (round: number, pickInRound: number) => `${round}.${String(pickInRound).padStart(2, "0")}`;
/** Before the time it has left: "4.03, 0:48". */
export const onTheClockSlotWords = (slot: string) => `${slot}, `;
export const pickedWords = (clubShortName: string, slot: string) => `${clubShortName}, ${slot}`;
/** A pick whose player the football data no longer holds (#323). */
export const lostPlayerWords = "Player missing from the football data";
export const noRoundsWords = "The draft's rounds are its squads' most players, and this league's squads have no size limit yet.";
