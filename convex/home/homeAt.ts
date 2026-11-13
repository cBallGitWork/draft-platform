import { v, type Infer } from "convex/values";
import { thisGameweekOf } from "../gameweeks/nextGameweek";
import { commentaryAt } from "../matchup/commentaryAt";
import type { HeldCommentary } from "../matchup/matchupShape";
import { LIVE_WINDOW_MS } from "../shared/dueMatches";
import { groupedBy } from "../shared/groupedBy";
import { DAY_MS } from "../shared/time";
import type { HeldLeagueHome, LeagueHome } from "./leagueHome";
import { matchdayAt } from "./matchday";

// League home as the screen shows it at its minute (#1550). A query taking the minute runs again,
// uncached, every minute for every open screen, so league home is read in three, none taking it
// (#2005): `clockOf` (homeClock.ts) sends the times, which `clockAt` judges at the minute to say
// which gameweek this is and which matchday is open; `ofLeague` reads the rest for that gameweek,
// its recap with the moment it leaves; and `matchdayOf` the open matchday's Vidiprinter, its delay a
// moment. Pure, so the screen and the tests put them together alike.

/** What `clockOf` sends: the league's head-to-head gameweeks with their deadlines (null where none
 *  is known), in order; the matchday margins (platformSettings.ts); and the matches kicking off near
 *  its hour, with when a read first found each at full time (null before). */
export const heldClock = v.object({
  gameweeks: v.array(v.object({ gameweek: v.number(), deadline: v.union(v.number(), v.null()) })),
  margins: v.object({ beforeMs: v.number(), afterMs: v.number() }),
  matches: v.array(v.object({ gameweek: v.number(), fixtureCode: v.number(), kickoff: v.number(), fullTimeAt: v.union(v.number(), v.null()) })),
});
export type HeldClock = Infer<typeof heldClock>;

/** League home's clock at a minute. */
export type HomeClock = {
  /** This gameweek (nextGameweek.ts's `thisGameweekOf`) among the league's head-to-heads; null
   *  with none, as in total points or with fewer than two teams. */
  gameweek: number | null;
  /** The matchday open, by its gameweek and its matches' codes, smallest first; null while the
   *  home is quiet. */
  matchday: { gameweek: number; fixtureCodes: number[] } | null;
};

/** How long before a minute, besides `afterMs`, a match kicking off may still hold its matchday
 *  open: the day before its latest final whistle (matchday.ts). A window joined across more days
 *  than that would leave its first day's lines out, while staying open. */
export const NEAR_BEFORE_MS = DAY_MS + LIVE_WINDOW_MS;

/** League home's clock at `now`, from `clockOf`'s times. */
export function clockAt({ gameweeks, margins, matches }: HeldClock, now: number): HomeClock {
  const deadlines = new Map(gameweeks.map(({ gameweek, deadline }) => [gameweek, deadline]));
  return {
    gameweek: thisGameweekOf(gameweeks, (gameweek) => deadlines.get(gameweek) ?? null, now)?.gameweek ?? null,
    matchday: matchdayOpen(matches, margins, now),
  };
}

/** The matchday open at `now`, or null while none is. Judged on the matches kicking off near `now`,
 *  not this gameweek's: a gameweek's first matchday opens hours before its first kickoff, while its
 *  deadline, and so the head-to-heads shown, may still be to come. */
function matchdayOpen(matches: HeldClock["matches"], margins: HeldClock["margins"], now: number): HomeClock["matchday"] {
  const near = matches.filter(({ kickoff }) => kickoff > now - NEAR_BEFORE_MS - margins.afterMs && kickoff <= now + margins.beforeMs);
  const byGameweek = groupedBy(near, ({ gameweek }) => gameweek);
  for (const [gameweek, fixtures] of [...byGameweek].toSorted(([one], [other]) => one - other)) {
    const open = matchdayAt(fixtures, margins, now);
    if (open !== null) return { gameweek, fixtureCodes: open.fixtureCodes.toSorted((one, other) => one - other) };
  }
  return null;
}

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
