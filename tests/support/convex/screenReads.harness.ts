// League home and the matchup read as their screens read them (#1550): the small query that tells
// the time (each sends its times, judged at the minute: #2005, #2008), then the clock-free ones it
// points at, put together at the minute as the live seams put them (src/home/liveHome.ts,
// src/matchup/liveMatchup.ts).

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { thisGameweekAt } from "../../../convex/gameweeks/nextGameweek";
import { clockAt, clockHourOf, leagueHomeAt } from "../../../convex/home/homeAt";
import { matchupAt } from "../../../convex/matchup/commentaryAt";
import type { actingAs } from "./leagues.harness";

type Caller = Awaited<ReturnType<typeof actingAs>>;

/** League home at `now`, as `caller` reads it. */
export async function leagueHomeOf(caller: Caller, leagueId: Id<"leagues">, now: number) {
  const clock = clockAt(await caller.query(api.home.homeClock.clockOf, { leagueId, hour: clockHourOf(now) }), now);
  const held = await caller.query(api.home.leagueHome.ofLeague, { leagueId, gameweek: clock.gameweek });
  const open = clock.matchday;
  const matchday = open === null ? null : { gameweek: open.gameweek, commentary: await caller.query(api.home.leagueHome.matchdayOf, { leagueId, ...open }) };
  return leagueHomeAt(held, matchday, now);
}

/** The matchup at `now`, as `caller` reads it: their own team's unless `asked` names one, in the
 *  gameweek it opens on unless `asked` names one. */
export async function matchupOf(caller: Caller, leagueId: Id<"leagues">, now: number, asked: { teamId?: Id<"teams">; gameweek?: number; game?: number } = {}) {
  const team = asked.teamId === undefined ? {} : { teamId: asked.teamId };
  const gameweeks = asked.gameweek === undefined ? await caller.query(api.matchup.matchupGameweek.gameweeksOf, { leagueId, ...team }) : null;
  const gameweek = asked.gameweek ?? (gameweeks === null ? null : thisGameweekAt(gameweeks, now));
  return matchupAt(await caller.query(api.matchup.matchup.ofTeam, { leagueId, ...asked, gameweek }), now);
}
