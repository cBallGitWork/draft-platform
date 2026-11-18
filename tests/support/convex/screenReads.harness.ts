// League home, the matchup, League settings, the waivers, Trades, My team's squad and Tactics, the pending claims and the card's action read as their screens read them (#1550): the small query that tells
// the time (each sends its times, judged at the minute: #2005, #2008), then the clock-free ones it
// points at, put together at the minute as the live seams put them (src/home/liveHome.ts,
// src/matchup/liveMatchup.ts).

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { answerAt } from "../../../convex/gameweeks/hourAnswers";
import { changesFromAt, thisGameweekAt } from "../../../convex/gameweeks/nextGameweek";
import { teamSquadAt } from "../../../convex/squads/teamSquadAt";
import { clockAt, clockHourOf, leagueHomeAt } from "../../../convex/home/homeAt";
import { matchupAt } from "../../../convex/matchup/commentaryAt";
import { tradesInHourAt } from "../../../convex/trades/tradesAt";
import { cardActionAt, firstRunsAt, pendingClaimsAt, waiversAt } from "../../../convex/waivers/runsAhead";
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

/** The league's waivers at `now`, judged from the hour's read, as `caller` reads them
 *  (src/myTeam/claims/liveClaims.ts, #2008). */
export async function waiversOf(caller: Caller, leagueId: Id<"leagues">, now = Date.now()) {
  return waiversAt(await caller.query(api.waivers.waiverOrder.ofLeague, { leagueId, hour: clockHourOf(now) }), now);
}

/** The Trades screen at `now`, judged from the hour's read, as `caller` reads it
 *  (src/trades/liveTrades.ts, #2008). */
export async function tradesOf(caller: Caller, leagueId: Id<"leagues">, now = Date.now()) {
  return tradesInHourAt(await caller.query(api.trades.tradeScreen.ofMyTeam, { leagueId, hour: clockHourOf(now) }), now);
}

/** A read's answer at `now` from its own hour's, which always holds one. */
function ofItsHour<Shown>(shown: Shown | undefined, read: string, now: number): Shown {
  if (shown === undefined) throw new Error(`${read} sent nothing for ${new Date(now).toISOString()}, in its own hour`);
  return shown;
}

/** My team's squad at `now`, kept to the minute from the hour's read, as `caller` reads it
 *  (src/myTeam/liveMyTeam.ts, #2008). */
export async function teamSquadOf(caller: Caller, leagueId: Id<"leagues">, now = Date.now()) {
  return ofItsHour(teamSquadAt(await caller.query(api.squads.teamSquad.ofMyTeam, { leagueId, hour: clockHourOf(now) }), now), "squads/teamSquad:ofMyTeam", now);
}

/** The Tactics tab at `now`, picked from the hour's read, as `caller` reads it
 *  (src/myTeam/tactics/liveTactics.ts, #2008). */
export async function tacticsOf(caller: Caller, leagueId: Id<"leagues">, now = Date.now()) {
  return ofItsHour(answerAt(await caller.query(api.lineup.tactics.ofMyTeam, { leagueId, hour: clockHourOf(now) }), now)?.tactics, "lineup/tactics:ofMyTeam", now);
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
