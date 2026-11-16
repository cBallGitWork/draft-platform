// The matchup preview's matches (preview.ts): Football's gameweek (../premierLeague/preview.ts),
// each match's clock, score and lines as the matchup reads them now or in its replay (#2455).

import type { MatchBreakdown } from "../../convex/matchup/matchupShape";
import { previewFullTimeGoals } from "../premierLeague/preview";
import type { GameweekMatch } from "../premierLeague/seam";
import type { Man } from "./previewMen";

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
function goalMinutes(match: GameweekMatch): [number[], number[]] {
  const playing = match.score?.state === "live" || match.score?.state === "halfTime";
  const upTo = playing ? (match.score?.minutes ?? 90) : 90;
  const spread = (goals: number, side: number) => Array.from({ length: goals }, (_, goal) => 1 + Math.floor(((upTo - 2) * (2 * goal + 1 + side)) / (2 * goals + 2)));
  const [home, away] = previewFullTimeGoals(match);
  return [spread(home, 0), spread(away, 1)];
}

/** A match's score `played` minutes in: Football's now; in the replay, its goals so far. */
export function scoreAt(match: GameweekMatch, played: number, clock: Clock): MatchBreakdown["score"] {
  const { score } = match;
  if (played < 0 || score === null || (score.state === "upcoming" && clock.kind === "now")) return null;
  if (clock.kind === "now" && score.state !== "upcoming") return { ...score, state: score.state };
  const [home, away] = goalMinutes(match);
  const goals = (minutes: readonly number[]) => minutes.filter((at) => at <= played).length;
  return { state: played <= MATCH_MINUTES ? "live" : "fullTime", homeGoals: goals(home), awayGoals: goals(away), minutes: Math.min(played, MATCH_MINUTES), clockLabel: null };
}

/** A made-up man's match broken down: a point for appearing, the rest goals at 1 each. */
export function categoriesOf(points: number | null): MatchBreakdown["categories"] {
  const all = { by: "all" } as const;
  return points === null
    ? [
        { stat: "minutes", name: "Minutes played", points: null },
        { stat: "goalsScored", name: "Goals scored", points: null },
      ]
    : [
        { stat: "minutes", name: "Minutes played", points: Math.min(points, 1), why: { actions: 1, value: { shape: "perAction", points: 1 }, pricedBy: all, cut: null } },
        { stat: "goalsScored", name: "Goals scored", points: Math.max(points - 1, 0), why: { actions: Math.max(points - 1, 0), value: { shape: "perAction", points: 1 }, pricedBy: all, cut: null } },
      ];
}

/** A match's lines, by its minute: kickoff, each goal, named for one of `men` at the scoring club
 *  where it has one (forwards first), half-time and full time. */
export function linesOf(match: GameweekMatch, men: readonly Man[]): { minute: number; text: string; about: number[] }[] {
  const { home, away } = match;
  const [homeGoals, awayGoals] = goalMinutes(match);
  const [homeAtFullTime, awayAtFullTime] = previewFullTimeGoals(match);
  const forwardsFirst = (man: Man) => (man.area === "attack" ? 0 : 1);
  const goalLines = (minutes: number[], club: GameweekMatch["home"]) => {
    const scorers = men.filter((man) => man.clubCode === club.code && man.area !== "goalkeeper").toSorted((one, other) => forwardsFirst(one) - forwardsFirst(other));
    return minutes.map((minute, goal) => {
      const scorer = scorers.length === 0 ? null : scorers[goal % scorers.length];
      return { minute, text: `${minute}' GOAL ${scorer?.name ?? club.shortName}`, about: scorer === null ? [] : [scorer.code] };
    });
  };
  return [
    { minute: 0, text: `KO ${home.shortName} v ${away.shortName}`, about: [] },
    ...goalLines(homeGoals, home),
    ...goalLines(awayGoals, away),
    { minute: 45, text: "45' HT", about: [] },
    { minute: MATCH_MINUTES, text: `FT ${home.shortName} ${homeAtFullTime}–${awayAtFullTime} ${away.shortName}`, about: [] },
  ];
}
