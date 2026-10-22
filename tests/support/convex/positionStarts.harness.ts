// The positions tests' starts: places on a sheet, and a man's starts made from them.

import type { Start } from "../../../convex/positions/positions";
import { DAY_MS } from "../../../convex/shared/time";

/** Where a start lined up: its formation, line and place. */
export type Place = Omit<Start, "fixtureCode" | "kickoff">;

// Places of a 4-2-3-1, as its sheet draws them: line 1 is the back four, right back first.
export const RIGHT_BACK: Place = { formation: "4-2-3-1", line: 1, place: 0 };
export const CENTRE_BACK: Place = { formation: "4-2-3-1", line: 1, place: 1 };
export const HOLDING: Place = { formation: "4-2-3-1", line: 2, place: 0 };
export const LEFT_WINGER: Place = { formation: "4-2-3-1", line: 3, place: 0 };
export const NUMBER_TEN: Place = { formation: "4-2-3-1", line: 3, place: 1 };

/** One start at each place, oldest first, a day apart from `firstDay`; each day's match is its own. */
export function startsFrom(firstDay: number, ...places: Place[]): Start[] {
  return places.map((place, index) => ({ ...place, fixtureCode: firstDay + index, kickoff: (firstDay + index) * DAY_MS }));
}

/** One start at each place, oldest first, on days 1, 2, 3 and on. */
export const played = (...places: Place[]) => startsFrom(1, ...places);

export const times = (place: Place, count: number): Place[] => Array<Place>(count).fill(place);

/** Five starts at centre back, on days 1 to 5, then `count` at right back from day 6. */
export const movedToFullBack = (count: number) => played(...times(CENTRE_BACK, 5), ...times(RIGHT_BACK, count));
