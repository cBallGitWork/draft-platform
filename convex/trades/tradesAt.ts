import { latestBegun, type LeagueDeadlines } from "../gameweeks/deadline";
import { deadlinesOf, lockCandidates } from "../waivers/runsAhead";
import type { HeldTrades, TradesView } from "./tradeScreen";

// The Trades screen at its minute (#2008). A query taking the minute runs again, uncached, every
// minute for every open screen, so tradeScreen.ts's `ofMyTeam` takes the hour instead, as Claims'
// waiver order does (../waivers/runsAhead.ts's `waiversAt`). What moves with the clock there, why
// trades are shut and each offer's closing and reviewer, turns only on the latest gameweek begun,
// so it sends them for each one a minute of the hour can see, and the screen picks its minute's
// here. Pure, so the screen and the tests alike.

/** Every latest gameweek begun that some minute of the hour starting at `hour` can see: null while
 *  none has begun at its start, then each begun by its end. */
export function begunInHour(deadlines: LeagueDeadlines, hour: number): (number | null)[] {
  return [...(latestBegun(deadlines, hour) === null ? [null] : []), ...lockCandidates(deadlines, hour)];
}

/** The Trades screen at `now`, from what `ofMyTeam` sent for `now`'s hour. */
export function tradesAt({ gameweeks, phases, offers, ...held }: HeldTrades, now: number): TradesView {
  const begun = latestBegun(deadlinesOf(gameweeks), now);
  const phase = phases.find((one) => one.begun === begun);
  if (phase === undefined) throw new Error(`The Trades read sent holds nothing for gameweek ${begun} the latest begun, at ${new Date(now).toISOString()}`);
  return { ...held, shut: phase.shut, offers: offers.map((offer, index) => ({ ...offer, ...phase.offers[index] })) };
}
