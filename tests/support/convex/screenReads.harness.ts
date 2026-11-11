// League home and the matchup read as their screens read them (#1550): the small query taking the
// minute, then the clock-free ones it points at, put together at the minute as the live seams put
// them (src/home/liveHome.ts, src/matchup/liveMatchup.ts).

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { leagueHomeAt } from "../../../convex/home/homeAt";
import { matchupAt } from "../../../convex/matchup/commentaryAt";
import type { actingAs } from "./leagues.harness";

type Caller = Awaited<ReturnType<typeof actingAs>>;

/** League home at `now`, as `caller` reads it. */
export async function leagueHomeOf(caller: Caller, leagueId: Id<"leagues">, now: number) {
  const clock = await caller.query(api.home.homeClock.clockOf, { leagueId, now });
  const held = await caller.query(api.home.leagueHome.ofLeague, { leagueId, gameweek: clock.gameweek });
  const open = clock.matchday;
  const matchday = open === null ? null : { gameweek: open.gameweek, commentary: await caller.query(api.home.leagueHome.matchdayOf, { leagueId, ...open }) };
  return leagueHomeAt(held, matchday, now);
}

/** The matchup at `now`, as `caller` reads it: their own team's unless `asked` names one, in the
 *  gameweek it opens on unless `asked` names one. */
export async function matchupOf(caller: Caller, leagueId: Id<"leagues">, now: number, asked: { teamId?: Id<"teams">; gameweek?: number; game?: number } = {}) {
  const team = asked.teamId === undefined ? {} : { teamId: asked.teamId };
  const gameweek = asked.gameweek ?? (await caller.query(api.matchup.matchupGameweek.thisGameweek, { leagueId, now, ...team }));
  return matchupAt(await caller.query(api.matchup.matchup.ofTeam, { leagueId, ...asked, gameweek }), now);
}
