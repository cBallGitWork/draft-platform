// League home, the matchup, League settings, the pending claims and the card's action read as their screens read them (#1550): the small query that tells
// the time (each sends its times, judged at the minute: #2005, #2008), then the clock-free ones it
// points at, put together at the minute as the live seams put them (src/home/liveHome.ts,
// src/matchup/liveMatchup.ts).

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { changesFromAt, thisGameweekAt } from "../../../convex/gameweeks/nextGameweek";
import { clockAt, clockHourOf, leagueHomeAt } from "../../../convex/home/homeAt";
import { matchupAt } from "../../../convex/matchup/commentaryAt";
import { cardActionAt, firstRunsAt, pendingClaimsAt } from "../../../convex/waivers/runsAhead";
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

/** League settings at `now`, as `caller` reads them: the gameweek a change applies from judged at
 *  `now` (#2008). */
export async function leagueSettingsOf(caller: Caller, leagueId: Id<"leagues">, now = Date.now()) {
  const held = await caller.query(api.rules.leagueSettings.settings, { leagueId });
  return { ...held, changesFrom: changesFromAt(held.changesFrom, now) };
}

/** The run that can first take a player, judged at `now` from the hour's waiver clock, as `caller`
 *  reads it (src/shared/useFirstRuns.ts, #2008). */
export async function firstRunsOf(caller: Caller, leagueId: Id<"leagues">, now = Date.now()) {
  return firstRunsAt(await caller.query(api.waivers.waiverClock.clockOf, { leagueId, hour: clockHourOf(now) }), now);
}

/** The pending claims at `now`, as `caller` reads them (src/myTeam/claims/liveClaims.ts). */
export async function pendingClaimsOf(caller: Caller, leagueId: Id<"leagues">, now = Date.now()) {
  return pendingClaimsAt(await caller.query(api.waivers.waiverClaims.pending, { leagueId }), await firstRunsOf(caller, leagueId, now));
}

/** The player card's action at `now`, as `caller` reads it (src/playerCard/livePlayerCard.ts). */
export async function cardActionOf(caller: Caller, leagueId: Id<"leagues">, playerCode: number, now = Date.now()) {
  return cardActionAt(await caller.query(api.waivers.waivers.cardActionOn, { leagueId, playerCode }), await firstRunsOf(caller, leagueId, now));
}

/** The matchup at `now`, as `caller` reads it: their own team's unless `asked` names one, in the
 *  gameweek it opens on unless `asked` names one. */
export async function matchupOf(caller: Caller, leagueId: Id<"leagues">, now: number, asked: { teamId?: Id<"teams">; gameweek?: number; game?: number } = {}) {
  const team = asked.teamId === undefined ? {} : { teamId: asked.teamId };
  const gameweeks = asked.gameweek === undefined ? await caller.query(api.matchup.matchupGameweek.gameweeksOf, { leagueId, ...team }) : null;
  const gameweek = asked.gameweek ?? (gameweeks === null ? null : thisGameweekAt(gameweeks, now));
  return matchupAt(await caller.query(api.matchup.matchup.ofTeam, { leagueId, ...asked, gameweek }), now);
}
