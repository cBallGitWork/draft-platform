import type { Result } from "../table/standings";
import { FORM_RESULTS } from "../table/standings";
import { byKickoff } from "../shared/fixtures";

// A real club's matches as its page shows them (#1936; spec/18, Club pages, `S18.7`, `S18.9`): each
// from the club's side, its form and its next match, pure so the query (clubPage.ts) and the
// preview read them alike.

type Club = { code: number; name: string; shortName: string };
type Score = { state: "upcoming" | "live" | "halfTime" | "fullTime"; homeGoals: number | null; awayGoals: number | null; minutes: number | null; clockLabel: string | null };

/** A match as the Football page holds it, with its gameweek: null while a postponed one waits. */
export type HeldMatch = { fixtureCode: number; gameweek: number | null; kickoff: number | null; home: Club; away: Club; score: Score | null };

/** One of a club's matches from its side: whether it is at home, who it meets, and the match's
 *  newest score as held (home's goals first). */
export type ClubFixture = { fixtureCode: number; gameweek: number | null; kickoff: number | null; atHome: boolean; opponent: Club; score: Score | null };

/** Every match `clubCode` plays among `matches`, in kickoff order, any with no time yet last. */
export function fixturesOf(matches: readonly HeldMatch[], clubCode: number): ClubFixture[] {
  return byKickoff(
    matches.flatMap(({ fixtureCode, gameweek, kickoff, home, away, score }) => {
      if (home.code !== clubCode && away.code !== clubCode) return [];
      const atHome = home.code === clubCode;
      return [{ fixtureCode, gameweek, kickoff, atHome, opponent: atHome ? away : home, score }];
    }),
  );
}

/** The club's goals and the opponent's, once the match has kicked off and both are read; else null. */
export function goalsOf({ atHome, score }: ClubFixture): { scored: number; conceded: number } | null {
  if (score === null || score.state === "upcoming" || score.homeGoals === null || score.awayGoals === null) return null;
  return atHome ? { scored: score.homeGoals, conceded: score.awayGoals } : { scored: score.awayGoals, conceded: score.homeGoals };
}

/** The club's result in a match at full time; null before then. */
export function clubResultOf(fixture: ClubFixture): Result | null {
  const goals = goalsOf(fixture);
  if (fixture.score?.state !== "fullTime" || goals === null) return null;
  if (goals.scored === goals.conceded) return "drawn";
  return goals.scored > goals.conceded ? "won" : "lost";
}

/** The club's form: the results of its latest FORM_RESULTS matches at full time, oldest first. */
export function clubFormOf(fixtures: readonly ClubFixture[]): Result[] {
  return fixtures.flatMap((fixture) => {
    const result = clubResultOf(fixture);
    return result === null ? [] : [result];
  }).slice(-FORM_RESULTS);
}

/** The club's next match: its first with a kickoff time that hasn't kicked off; null when none is
 *  left. A match being played is under way, not next. */
export function nextFixtureOf(fixtures: readonly ClubFixture[]): (ClubFixture & { kickoff: number }) | null {
  const next = fixtures.find(({ kickoff, score }) => kickoff !== null && (score === null || score.state === "upcoming"));
  return next === undefined || next.kickoff === null ? null : { ...next, kickoff: next.kickoff };
}
