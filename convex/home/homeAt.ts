import { commentaryAt } from "../matchup/commentaryAt";
import type { HeldCommentary } from "../matchup/matchupShape";
import type { HeldLeagueHome, LeagueHome } from "./leagueHome";

// League home as the screen shows it at its minute (#1550). A query taking the minute runs again,
// uncached, every minute for every open screen, so league home is read in three: `clockOf`
// (homeClock.ts), the small one taking the minute, says which gameweek this is and which matchday
// is open; `ofLeague` reads the rest for that gameweek, its recap with the moment it leaves; and
// `matchdayOf` the open matchday's Vidiprinter, its delay a moment. Pure, so the screen and the tests
// put them together alike.

/** The open matchday's Vidiprinter as `matchdayOf` sends it; null while none is open. */
export type HeldMatchday = { gameweek: number; commentary: HeldCommentary } | null;

/** League home at `now`, from `ofLeague`'s read and the open matchday's. */
export function leagueHomeAt(held: HeldLeagueHome, matchday: HeldMatchday, now: number): LeagueHome {
  const { recap, ...home } = held;
  return {
    ...home,
    matchday: matchday === null ? null : { gameweek: matchday.gameweek, commentary: commentaryAt(matchday.commentary, now) },
    recap: recap === null ? null : recapAt(recap, now),
  };
}

/** The recap at `now`: gone once the moment it leaves has come. */
function recapAt({ until, ...recap }: NonNullable<HeldLeagueHome["recap"]>, now: number): LeagueHome["recap"] {
  return until !== null && now >= until ? null : recap;
}
