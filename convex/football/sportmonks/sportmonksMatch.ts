// One Sportmonks match (#1391) as ours: its score and clock, and, from a live read, its lineups
// (starters, bench, formation places), each man's stats so far (`lineups.details`) and its events
// timeline (goals, cards, substitutions, VAR, by minute).

import type { Infer } from "convex/values";
import type { ScoreRead } from "../scoreReads";
import type { sportmonksEvent, sportmonksLineupMan } from "../../schema";
import { SPORTMONKS, type RawEvent, type RawFixture } from "./sportmonksRaw";

export type SportmonksMan = Infer<typeof sportmonksLineupMan>;
export type SportmonksEvent = Infer<typeof sportmonksEvent>;

/** One match as a live read gives it. */
export interface SportmonksMatch {
  score: ScoreRead;
  men: SportmonksMan[];
  events: SportmonksEvent[];
}

/** Sportmonks' lineup types: named to start, or on the bench. */
const LINEUP_STARTER = 11;
const LINEUP_BENCH = 12;

/** Sportmonks' match states (its `state_id`), as our four. A postponed, delayed or unsettled match
 *  is not started; one abandoned, cancelled, suspended or stuck is a problem for the run row, as
 *  any state not listed here is, never guessed at. */
const STATES: Record<number, ScoreRead["state"]> = {
  1: "upcoming", // NS
  10: "upcoming", // POSTPONED
  13: "upcoming", // TBA
  16: "upcoming", // DELAYED
  2: "live", // INPLAY_1ST_HALF
  22: "live", // INPLAY_2ND_HALF
  6: "live", // INPLAY_ET
  9: "live", // INPLAY_PENALTIES
  3: "halfTime", // HT
  4: "halfTime", // BREAK, before extra time
  21: "halfTime", // EXTRA_TIME_BREAK
  25: "halfTime", // PEN_BREAK
  5: "fullTime", // FT
  7: "fullTime", // AET
  8: "fullTime", // FT_PEN
  17: "fullTime", // AWARDED
};

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
  return { ...base, homeGoals: goals("home"), awayGoals: goals("away"), minutes: ticking?.minutes ?? null };
}

/** One match as a live read gives it. Each man's stats are Sportmonks' running totals, kept as
 *  sent; a yes-or-no stat, as `captain` comes (true, in a real read of 8 Nov 2026), is 1 or 0; any
 *  other stat that isn't a number throws, naming it, rather than be dropped. */
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
        const value = typeof data?.value === "boolean" ? Number(data.value) : data?.value;
        if (typeof value !== "number") {
          throw new Error(`${SPORTMONKS} sent stat ${type_id} for player ${man.player_id} in match ${match.id} as ${JSON.stringify(value)}`);
        }
        return { typeId: type_id, value };
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

/** By minute, then extra minute, then Sportmonks' own order within the minute. */
function byMinute(a: RawEvent, b: RawEvent): number {
  return (
    (a.minute ?? 0) - (b.minute ?? 0) || (a.extra_minute ?? 0) - (b.extra_minute ?? 0) || (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
}
