// Each man's match stats from one Sportmonks match (#1415, spec/07 `S07.4`, `S07.7`, `S07.10`): a
// `sportmonksMatches` row's lineups, `lineups.details` and events, with its score, to one record per
// man in either team sheet, in `playerMatchStats`' shape. Each statistic type Sportmonks sends becomes
// the catalogue stats SPORTMONKS_STAT_IDS gives it; the ones no type sends (NOT_IN_SPORTMONKS) that a
// match settles are worked out here: appearance, start and subs from the lineups and substitution
// events, result and winning goal from the score and goal events, and the half-time clean sheet and
// goals conceded from the goal events' minutes. Pure; sportmonksLive.ts stores what it gives.

import type { Infer } from "convex/values";
import type { ScoreRead } from "../scoreReads";
import type { sportmonksPlayerMatchRecord } from "../../schema";
import { HALF_TIME_STATS } from "../premierLeague/plMatch";
import { SM_EVENT_TYPE } from "../sportmonksCommentary";
import { SPORTMONKS_STAT_IDS } from "./sportmonksStats";
import type { SportmonksEvent, SportmonksMan } from "./sportmonksMatch";
import { SM_STATE, SPORTMONKS } from "./sportmonksRaw";

export type SportmonksPlayerMatchRecord = Infer<typeof sportmonksPlayerMatchRecord>;

/** The catalogue stats worked out here, as statCatalogueList.ts names them. */
export const WORKED_OUT = {
  appearances: "appearances",
  started: "game_started",
  subOn: "total_sub_on",
  subOff: "total_sub_off",
  wins: "wins",
  draws: "draws",
  losses: "losses",
  winningGoal: "winning_goal",
  cleanSheetHalfTime: HALF_TIME_STATS.cleanSheet,
  goalsConcededHalfTime: HALF_TIME_STATS.goalsConceded,
} as const;

/** The last minute of the first half: a goal in its added time (45+2') is before half-time
 *  (Craig, 9 Nov 2026, on #990, `S05.16`). */
const HALF_TIME_MINUTE = 45;

/** The goal events: a goal, an own goal and a scored penalty. */
const GOAL_TYPES: ReadonlySet<number> = new Set([SM_EVENT_TYPE.goal, SM_EVENT_TYPE.ownGoal, SM_EVENT_TYPE.penaltyGoal]);

/** Sportmonks' match states before half-time, when its first-half score isn't settled yet. */
const BEFORE_HALF_TIME: ReadonlySet<number> = new Set([
  SM_STATE.notStarted,
  SM_STATE.firstHalf,
  SM_STATE.postponed,
  SM_STATE.toBeAnnounced,
  SM_STATE.delayed,
]);

/** Whether a match in this Sportmonks state has reached half-time. */
export function halfTimeReached(stateId: number): boolean {
  return !BEFORE_HALF_TIME.has(stateId);
}

/** Each statistic type id and the catalogue stats it fills: one type can fill two (TACKLES). */
const STATS_BY_TYPE: ReadonlyMap<number, readonly string[]> = Object.entries(SPORTMONKS_STAT_IDS).reduce((byType, [stat, typeId]) => {
  byType.set(typeId, [...(byType.get(typeId) ?? []), stat]);
  return byType;
}, new Map<number, string[]>());

/** What the mapper reads of one match. */
export interface SportmonksMatchRead {
  score: ScoreRead;
  /** Sportmonks' ids for the home and away sides. */
  homeTeamId: number;
  awayTeamId: number;
  /** Whether the match has reached half-time (`halfTimeReached`). */
  halfTime: boolean;
  men: readonly SportmonksMan[];
  /** In the order they happened (sportmonksMatch.ts's order). */
  events: readonly SportmonksEvent[];
}

/** One goal: the side that scored it, its scorer, whether it was an own goal, and its minute. */
interface Goal {
  side: "home" | "away";
  playerId: number | null;
  ownGoal: boolean;
  minute: number | null;
}

/** The match's goals in the order the score went, each side's read off its `result` ("2-1", home
 *  first), so an own goal counts for the side it went to whichever team Sportmonks files it under.
 *  A goal with no result, a result that isn't one goal on from the last, or, at full time, goals
 *  that don't add up to the final score, throws rather than give anyone the wrong result. */
export function goalsOf(match: Pick<SportmonksMatchRead, "score" | "events">): Goal[] {
  const { fixtureCode } = match.score;
  const scored = match.events.filter((event) => GOAL_TYPES.has(event.typeId));
  const parsed = scored.map((event) => {
    const found = /^(\d+)-(\d+)$/.exec(event.result ?? "");
    if (found === null) throw new Error(`${SPORTMONKS} sent goal ${event.id} in match ${fixtureCode} with result ${JSON.stringify(event.result)}`);
    return { event, home: Number(found[1]), away: Number(found[2]) };
  });
  // By the score itself: two goals in one minute can come in either order.
  parsed.sort((a, b) => a.home + a.away - (b.home + b.away));
  const goals: Goal[] = [];
  let [home, away] = [0, 0];
  for (const { event, home: nextHome, away: nextAway } of parsed) {
    const side = nextHome === home + 1 && nextAway === away ? "home" : nextAway === away + 1 && nextHome === home ? "away" : null;
    if (side === null) {
      throw new Error(`${SPORTMONKS} sent goal ${event.id} in match ${fixtureCode} as ${event.result} after ${home}-${away}`);
    }
    goals.push({ side, playerId: event.playerId, ownGoal: event.typeId === SM_EVENT_TYPE.ownGoal, minute: event.minute });
    [home, away] = [nextHome, nextAway];
  }
  const { state, homeGoals, awayGoals } = match.score;
  if (state === "fullTime" && (home !== homeGoals || away !== awayGoals)) {
    throw new Error(`The goals ${SPORTMONKS} sent for match ${fixtureCode} come to ${home}-${away}, its score to ${homeGoals}-${awayGoals}`);
  }
  return goals;
}

/** The winning goal: the one that put the winners in front for good, so in a 3-1 that went 1-0,
 *  2-0, 2-1, 3-1 it is the 1-0. Null for a draw, and for an own goal (Craig, 12 Nov 2026, on #1415). */
export function winningGoal(goals: readonly Goal[], winner: "home" | "away"): Goal | null {
  let ahead: Goal | null = null;
  let [home, away] = [0, 0];
  for (const goal of goals) {
    const wasAhead = winner === "home" ? home > away : away > home;
    if (goal.side === "home") home += 1;
    else away += 1;
    const isAhead = winner === "home" ? home > away : away > home;
    if (isAhead && !wasAhead) ahead = goal;
  }
  return ahead === null || ahead.ownGoal ? null : ahead;
}

/** One record per man in either team sheet. A man who started, or came on, played; an unused
 *  substitute did not, and has no stats (`S07.4`). Results and the winning goal are given at full
 *  time, to men who played only (Craig, 12 Nov 2026, on #1415); the half-time stats from half-time,
 *  to starters only (`S05.16`). The match stays provisional until full time and until every man who
 *  played has sent his `lineups.details` (`S07.10`). A man on neither side, or a stat type sent twice
 *  for one man, throws. */
export function sportmonksPlayerStats(match: SportmonksMatchRead): SportmonksPlayerMatchRecord[] {
  const { score, homeTeamId, awayTeamId } = match;
  const { fixtureCode } = score;
  const subs = match.events.filter((event) => event.typeId === SM_EVENT_TYPE.substitution);
  const cameOn = new Set(subs.map((event) => event.playerId));
  const wentOff = new Set(subs.map((event) => event.relatedPlayerId));
  const goals = goalsOf(match);
  const fullTime = score.state === "fullTime";
  const winner = !fullTime || score.homeGoals === score.awayGoals ? null : score.homeGoals! > score.awayGoals! ? "home" : "away";
  const winnersGoal = winner === null ? null : winningGoal(goals, winner);
  const conceded = (side: "home" | "away") =>
    goals.filter((goal) => goal.side !== side && goal.minute !== null && goal.minute <= HALF_TIME_MINUTE).length;

  const records = match.men.map((man) => {
    const side = man.teamId === homeTeamId ? "home" : man.teamId === awayTeamId ? "away" : null;
    if (side === null) throw new Error(`${SPORTMONKS} put player ${man.playerId} in match ${fixtureCode} for team ${man.teamId}, neither side`);
    const played = man.started || cameOn.has(man.playerId);
    const stats = played ? sentStats(man, fixtureCode) : {};
    if (played) {
      stats[WORKED_OUT.appearances] = 1;
      stats[WORKED_OUT.started] = man.started ? 1 : 0;
      stats[WORKED_OUT.subOn] = man.started ? 0 : 1;
      stats[WORKED_OUT.subOff] = wentOff.has(man.playerId) ? 1 : 0;
      if (fullTime) {
        stats[WORKED_OUT.wins] = winner === side ? 1 : 0;
        stats[WORKED_OUT.draws] = winner === null ? 1 : 0;
        stats[WORKED_OUT.losses] = winner !== null && winner !== side ? 1 : 0;
        stats[WORKED_OUT.winningGoal] = winnersGoal?.playerId === man.playerId ? 1 : 0;
      }
      if (match.halfTime && man.started) {
        stats[WORKED_OUT.goalsConcededHalfTime] = conceded(side);
        stats[WORKED_OUT.cleanSheetHalfTime] = conceded(side) === 0 ? 1 : 0;
      }
    }
    return { playerCode: man.playerId, fixtureCode, clubCode: man.teamId, started: man.started, played, arrived: man.stats.length > 0, stats };
  });
  const complete = fullTime && records.every((record) => !record.played || record.arrived);
  return records.map((record) => ({ ...record, state: complete ? ("complete" as const) : ("provisional" as const) }));
}

/** The catalogue stats a man's `lineups.details` fill; a type the catalogue has no stat for is not
 *  one we keep (a match rating). */
function sentStats(man: SportmonksMan, fixtureCode: number): Record<string, number> {
  const stats: Record<string, number> = {};
  const seen = new Set<number>();
  for (const { typeId, value } of man.stats) {
    if (seen.has(typeId)) throw new Error(`${SPORTMONKS} sent stat ${typeId} twice for player ${man.playerId} in match ${fixtureCode}`);
    seen.add(typeId);
    for (const stat of STATS_BY_TYPE.get(typeId) ?? []) stats[stat] = value;
  }
  return stats;
}
