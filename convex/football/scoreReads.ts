// Each match's score and clock as each feed sends it (#49, #50): FPL's fixtures, read by the
// football sync, and the Premier League's fixture list, read by the live tick. A read that does not
// give a match's score is a problem for the run row, never a score: the held one stands until a
// read gives one (matchScores.ts).

import type { Infer } from "convex/values";
import type { RawFixture } from "./fpl";
import {
  PL_FULL_TIME,
  PL_HALF_TIME_PHASE,
  PL_IN_PLAY,
  PL_UPCOMING,
  type RawPlFixture,
} from "./premierLeague";
import type { matchState, scoreProblem, scoreRead } from "../schema";
import { MINUTE_MS, SECOND_MS } from "../shared/time";

export type ScoreRead = Infer<typeof scoreRead>;
export type ScoreProblem = Infer<typeof scoreProblem>;
type MatchState = Infer<typeof matchState>;

/** Each feed as a problem names it. */
const FPL = "FPL";
const PL = "the Premier League";

/** What one feed's read gives: a score for each match it could read, a problem for each it could not. */
export interface ScoreReads {
  reads: ScoreRead[];
  problems: ScoreProblem[];
}

/** Each match's score from one read, by `read`; one that throws becomes a problem, the rest go on. */
export function readEach<Match>(matches: Match[], codeOf: (match: Match) => number, read: (match: Match) => ScoreRead): ScoreReads {
  const scores: ScoreReads = { reads: [], problems: [] };
  for (const match of matches) {
    try {
      scores.reads.push(read(match));
    } catch (error: unknown) {
      if (!(error instanceof Error)) throw error;
      scores.problems.push({ fixtureCode: codeOf(match), problem: error.message });
    }
  }
  return scores;
}

/** A match not yet kicked off: no score and no clock. */
function upcoming(fixtureCode: number): ScoreRead {
  return { fixtureCode, state: "upcoming", homeGoals: null, awayGoals: null, minutes: null, clockLabel: null };
}

/** FPL's score for one match. A match with no kickoff time is postponed, so not started whatever
 *  `started` says; one kicked off must carry both scores and its minutes. */
export function fplScoreRead(fixture: RawFixture): ScoreRead {
  if (fixture.started === false || (fixture.started !== true && fixture.kickoff_time === null)) return upcoming(fixture.code);
  if (fixture.started !== true) throw new Error(`${FPL} sent started ${JSON.stringify(fixture.started)}`);
  if (typeof fixture.finished_provisional !== "boolean") {
    throw new Error(`${FPL} sent finished_provisional ${JSON.stringify(fixture.finished_provisional)}`);
  }
  const state: MatchState = fixture.finished_provisional ? "fullTime" : "live";
  return {
    fixtureCode: fixture.code,
    state,
    homeGoals: goals(FPL, state, fixture.team_h_score),
    awayGoals: goals(FPL, state, fixture.team_a_score),
    minutes: requireNumber(FPL, "minutes", fixture.minutes),
    clockLabel: null,
  };
}

/** The Premier League's score for one match, under FPL's `fixtureCode`. Its 0–0 before kickoff is
 *  no score; a status it has not been seen to send is a problem, not guessed at. */
export function plScoreRead(fixture: RawPlFixture, fixtureCode: number): ScoreRead {
  const { status, phase, clock, teams } = fixture;
  if (status === PL_UPCOMING) return upcoming(fixtureCode);
  let state: MatchState;
  if (status === PL_FULL_TIME) state = "fullTime";
  else if (status === PL_IN_PLAY) state = phase === PL_HALF_TIME_PHASE ? "halfTime" : "live";
  else throw new Error(`${PL} sent status ${JSON.stringify(status)}`);
  const secs = requireNumber(PL, "clock secs", clock?.secs);
  if (typeof clock?.label !== "string") throw new Error(`${PL} sent clock label ${JSON.stringify(clock?.label)}`);
  return {
    fixtureCode,
    state,
    homeGoals: goals(PL, state, teams?.[0]?.score),
    awayGoals: goals(PL, state, teams?.[1]?.score),
    minutes: Math.floor((secs * SECOND_MS) / MINUTE_MS),
    clockLabel: clock.label,
  };
}

function goals(feed: string, state: MatchState, sent: unknown): number {
  if (typeof sent !== "number" || !Number.isInteger(sent) || sent < 0) {
    throw new Error(`${feed} sent score ${JSON.stringify(sent)} for a match at ${state}`);
  }
  return sent;
}

function requireNumber(feed: string, what: string, sent: unknown): number {
  if (typeof sent !== "number" || !Number.isFinite(sent)) throw new Error(`${feed} sent ${what} ${JSON.stringify(sent)}`);
  return sent;
}
