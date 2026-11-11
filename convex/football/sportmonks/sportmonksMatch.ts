// One Sportmonks match (#1391) as ours: its score and clock, and, from a live read, its lineups
// (starters, bench, formation places), each man's stats so far (`lineups.details`) and its events
// timeline (goals, cards, substitutions, VAR, by minute).

import type { Infer } from "convex/values";
import type { ScoreRead } from "../scoreReads";
import type { sportmonksEvent, sportmonksLineupMan } from "../../schema";
import { AWAY, HOME, SM_STATE, SPORTMONKS, type RawEvent, type RawFixture } from "./sportmonksRaw";

export type SportmonksMan = Infer<typeof sportmonksLineupMan>;
export type SportmonksEvent = Infer<typeof sportmonksEvent>;

/** One match as a live read gives it. */
export interface SportmonksMatch {
  score: ScoreRead;
  men: SportmonksMan[];
  events: SportmonksEvent[];
}

/** Sportmonks' lineup types: named to start, or on the bench. */
export const LINEUP_STARTER = 11;
const LINEUP_BENCH = 12;

/** Sportmonks' match states (its `state_id`), as our four. A postponed, delayed or unsettled match
 *  is not started; one abandoned, cancelled, suspended or stuck is a problem for the run row, as
 *  any state not listed here is, never guessed at. */
const STATES: Record<number, ScoreRead["state"]> = {
  [SM_STATE.notStarted]: "upcoming",
  [SM_STATE.postponed]: "upcoming",
  [SM_STATE.toBeAnnounced]: "upcoming",
  [SM_STATE.delayed]: "upcoming",
  [SM_STATE.firstHalf]: "live",
  [SM_STATE.secondHalf]: "live",
  [SM_STATE.extraTime]: "live",
  [SM_STATE.penalties]: "live",
  [SM_STATE.halfTime]: "halfTime",
  [SM_STATE.breakBeforeExtraTime]: "halfTime",
  [SM_STATE.extraTimeBreak]: "halfTime",
  [SM_STATE.penaltyBreak]: "halfTime",
  [SM_STATE.fullTime]: "fullTime",
  [SM_STATE.afterExtraTime]: "fullTime",
  [SM_STATE.afterPenalties]: "fullTime",
  [SM_STATE.awarded]: "fullTime",
};

/** Whether a match in this state is over. */
export function isFullTime(stateId: number): boolean {
  return STATES[stateId] === "fullTime";
}

/** What Sportmonks calls a match's running score among its `scores`. */
const CURRENT_SCORE = "CURRENT";

/** One match's score and clock. Before kickoff there is none; from it, the running score must be
 *  there for both sides. The minute is the ticking period's, when the read asked for periods. */
export function smScoreRead(match: RawFixture): ScoreRead {
  const state = STATES[match.state_id];
  if (state === undefined) throw new Error(`${SPORTMONKS} sent state ${match.state_id} for match ${match.id}`);
  const base = { fixtureCode: match.id, state, clockLabel: null };
  if (state === "upcoming") return { ...base, homeGoals: null, awayGoals: null, minutes: null };
  const goals = (side: string) => {
    const score = match.scores?.find((one) => one.description === CURRENT_SCORE && one.score.participant === side);
    if (score === undefined || !Number.isInteger(score.score.goals)) {
      throw new Error(`${SPORTMONKS} sent no ${side} score for match ${match.id} at ${state}`);
    }
    return score.score.goals;
  };
  const ticking = match.periods?.find((period) => period.ticking === true);
  return { ...base, homeGoals: goals(HOME), awayGoals: goals(AWAY), minutes: ticking?.minutes ?? null };
}

/** One match as a live read gives it. Each man's stats are Sportmonks' running totals, kept as
 *  sent; a stat that isn't a number throws, naming it, rather than be dropped. */
export function mapSportmonksMatch(match: RawFixture): SportmonksMatch {
  const men = (match.lineups ?? []).map((man): SportmonksMan => {
    if (man.type_id !== LINEUP_STARTER && man.type_id !== LINEUP_BENCH) {
      throw new Error(`${SPORTMONKS} sent lineup type ${man.type_id} for player ${man.player_id} in match ${match.id}`);
    }
    return {
      playerId: man.player_id,
      teamId: man.team_id,
      started: man.type_id === LINEUP_STARTER,
      formationField: man.formation_field,
      formationPosition: man.formation_position,
      stats: (man.details ?? []).map(({ type_id, data }) => {
        if (typeof data?.value !== "number") {
          throw new Error(`${SPORTMONKS} sent stat ${type_id} for player ${man.player_id} in match ${match.id} as ${JSON.stringify(data?.value)}`);
        }
        return { typeId: type_id, value: data.value };
      }),
    };
  });
  const events = [...(match.events ?? [])].sort(byMinute).map(
    (event): SportmonksEvent => ({
      id: event.id,
      typeId: event.type_id,
      minute: event.minute,
      extraMinute: event.extra_minute,
      teamId: event.participant_id,
      playerId: event.player_id,
      relatedPlayerId: event.related_player_id,
      result: event.result,
      info: event.info,
      addition: event.addition,
    }),
  );
  return { score: smScoreRead(match), men, events };
}

/** Events by minute, then extra minute: the order they happened in. Sorting is stable, so events in
 *  the same minute keep the order they came in. */
export function byEventMinute(a: Pick<SportmonksEvent, "minute" | "extraMinute">, b: Pick<SportmonksEvent, "minute" | "extraMinute">): number {
  return (a.minute ?? 0) - (b.minute ?? 0) || (a.extraMinute ?? 0) - (b.extraMinute ?? 0);
}

/** A raw event's minute and extra minute, as byEventMinute reads them. */
const minuteOfRaw = (event: RawEvent) => ({ minute: event.minute, extraMinute: event.extra_minute });

/** By minute, then extra minute, then Sportmonks' own order within the minute. */
function byMinute(a: RawEvent, b: RawEvent): number {
  return byEventMinute(minuteOfRaw(a), minuteOfRaw(b)) || (a.sort_order ?? 0) - (b.sort_order ?? 0);
}
