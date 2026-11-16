// The matchup preview's matches (preview.ts): Football's gameweek (../premierLeague/preview.ts),
// each match's clock, score and lines as the matchup reads them now or in its replay (#2455). Each
// match comes with its goals at full time, home first, which preview.ts reads from Football's.

import type { MatchBreakdown } from "../../convex/matchup/matchupShape";
import type { MatchStats } from "../../convex/scoring/values";
import { CLEAN_SHEETS, GOALS, MINUTES_STAT } from "../../convex/stats/matchRecords";
import type { PlayedMatch } from "../playerCard/seam";
import type { GameweekMatch } from "../premierLeague/seam";

import type { Man } from "./previewMen";

/** A match of Football's gameweek and its goals at full time, home first. */
export type ReplayMatch = GameweekMatch & { fullTime: readonly [number, number] };

/** How long a man's match runs, stoppage time in, and how far apart the replay kicks Football's
 *  kickoff times off. */
export const MATCH_MINUTES = 95;
export const KICKOFF_GAP = 30;

/** Where the matchup stands: as Football's gameweek does now, or `minute` minutes into the replay. */
export type Clock = { kind: "now" } | { kind: "replay"; minute: number };

/** The gameweek's kickoff times, earliest first: the replay's kickoffs, one each. */
export const kickoffsOf = (matches: readonly GameweekMatch[]) => [...new Set(matches.map(({ kickoff }) => kickoff))].toSorted((one, other) => (one ?? 0) - (other ?? 0));

/** The minutes each side of a match scores in, home first: its full-time goals spread over the
 *  match, all before Football's clock while it is being played, so its score stands as Football's. */
function goalMinutes(match: ReplayMatch): [number[], number[]] {
  const playing = match.score?.state === "live" || match.score?.state === "halfTime";
  const upTo = playing ? (match.score?.minutes ?? 90) : 90;
  const spread = (goals: number, side: number) => Array.from({ length: goals }, (_, goal) => 1 + Math.floor(((upTo - 2) * (2 * goal + 1 + side)) / (2 * goals + 2)));
  const [home, away] = match.fullTime;
  return [spread(home, 0), spread(away, 1)];
}

/** A match's score `played` minutes in: Football's now; in the replay, its goals so far. */
export function scoreAt(match: ReplayMatch, played: number, clock: Clock): MatchBreakdown["score"] {
  const { score } = match;
  if (played < 0 || score === null || (score.state === "upcoming" && clock.kind === "now")) return null;
  if (clock.kind === "now" && score.state !== "upcoming") return { ...score, state: score.state };
  const [home, away] = goalMinutes(match);
  const goals = (minutes: readonly number[]) => minutes.filter((at) => at <= played).length;
  return { state: played <= MATCH_MINUTES ? "live" : "fullTime", homeGoals: goals(home), awayGoals: goals(away), minutes: Math.min(played, MATCH_MINUTES), clockLabel: null };
}

/** A goal: its minute, and the man who scored it, or null for one none of the men scored. */
export type Goal = { minute: number; club: GameweekMatch["home"]; scorer: Man | null };

/** A match's goals, by side: each club's first goals scored by its men who score in the match, as
 *  `goalsBy` gives (their player cards' at full time, #2478), forwards first; the rest by the club. */
export function goalsOf(match: ReplayMatch, men: readonly Man[], goalsBy: (man: Man) => number): Goal[] {
  const forwardsFirst = (man: Man) => (man.area === "attack" ? 0 : 1);
  const [homeMinutes, awayMinutes] = goalMinutes(match);
  const clubGoals = (minutes: number[], club: GameweekMatch["home"]) => {
    const scorers = men
      .filter((man) => man.clubCode === club.code)
      .toSorted((one, other) => forwardsFirst(one) - forwardsFirst(other))
      .flatMap((man) => Array.from({ length: goalsBy(man) }, () => man));
    return minutes.map((minute, goal) => ({ minute, club, scorer: scorers[goal] ?? null }));
  };
  return [...clubGoals(homeMinutes, match.home), ...clubGoals(awayMinutes, match.away)];
}

/** His record `played` minutes into a match of the replay, from his card's at full time: his minutes
 *  so far, his goals by their lines' minutes, a clean sheet only at full time, and the rest of his
 *  figures coming in step with the clock. */
export function recordAt(fullTime: MatchStats, played: number, goals: readonly Goal[], code: number): MatchStats {
  const share = played / MATCH_MINUTES;
  const scoredSoFar = goals.filter(({ minute, scorer }) => scorer?.code === code && minute <= played).length;
  const soFar = (stat: string, count: number) => (stat === MINUTES_STAT ? Math.min(count, played) : stat === GOALS ? scoredSoFar : stat === CLEAN_SHEETS ? 0 : Math.floor(count * share));
  return Object.fromEntries(Object.entries(fullTime).map(([stat, count]) => [stat, soFar(stat, count)]));
}

/** What a goal is worth to a man by his card's match at full time: his goals' points over his goals;
 *  null with no goal there. */
export function goalWorthOf(match: PlayedMatch | null): number | null {
  const goals = match?.points[0].categories.find(({ stat }) => stat === GOALS);
  return goals === undefined || goals.points === null || goals.why.actions === 0 ? null : goals.points / goals.why.actions;
}

/** A match's lines, by its minute: kickoff, each goal, named for its scorer or else his club,
 *  half-time and full time. */
export function linesOf(match: ReplayMatch, goals: readonly Goal[]): { minute: number; text: string; about: number[] }[] {
  const { home, away } = match;
  const [homeAtFullTime, awayAtFullTime] = match.fullTime;
  return [
    { minute: 0, text: `KO ${home.shortName} v ${away.shortName}`, about: [] },
    ...goals.map(({ minute, club, scorer }) => ({ minute, text: `${minute}' GOAL ${scorer?.name ?? club.shortName}`, about: scorer === null ? [] : [scorer.code] })),
    { minute: 45, text: "45' HT", about: [] },
    { minute: MATCH_MINUTES, text: `FT ${home.shortName} ${homeAtFullTime}–${awayAtFullTime} ${away.shortName}`, about: [] },
  ];
}
