// A player's points for one match under a league's scoring set (spec/14, How a rule scores; #29).
// The scoring set is the league's rule, so it is always an argument, never a constant.

import {
  AREAS,
  requireNumber,
  showValue,
  validateScoringSet,
  type Area,
  type BandsRule,
  type ScoringRule,
  type ScoringSet,
} from "./scoringSet";

/** A player's stats for one match, by the feeds' own keys. */
export type MatchStats = Readonly<Record<string, number>>;

/** One category's points, or null ("—") while his record for the match hasn't arrived. */
export interface CategoryPoints {
  stat: string;
  points: number | null;
}

/** A player's match: each rule's category in the set's order, and their total, null with them. */
export interface MatchPoints {
  total: number | null;
  categories: CategoryPoints[];
}

/**
 * A player's points for one match, by the area of the slot he starts in, whatever his position: a
 * centre-back played in midfield scores as a midfielder. `record` is null while his whole record
 * for the match hasn't arrived: every category is then "—" and so is the total, never a guess.
 * Once it has arrived, a stat it leaves out is 0 (spec/14). A bad set, area or stat throws.
 */
export function scoreMatch(record: MatchStats | null, set: ScoringSet, area: Area): MatchPoints {
  validateScoringSet(set);
  if (!AREAS.includes(area)) throw new Error(`${showValue(area)} is not one of the pitch's six areas`);
  if (record === null) {
    return { total: null, categories: set.rules.map((rule) => ({ stat: rule.stat, points: null })) };
  }
  const categories = set.rules.map((rule) => ({
    stat: rule.stat,
    points: rulePoints(rule, area, statIn(record, rule.stat)),
  }));
  return { total: sum(categories.map((category) => category.points)), categories };
}

/** Only the record's own keys count: a rule on `constructor` must not read Object's. A stat the
 *  feeds sent as anything but a number is bad data, never 0. */
function statIn(record: MatchStats, stat: string): number {
  if (!Object.hasOwn(record, stat)) return 0;
  const actions = record[stat];
  requireNumber(actions, `his record's ${stat} is`);
  return actions;
}

/** Points too large to be a number throw. No action under a negative rule (0 yellow cards at -1)
 *  is -0 in JavaScript, which a saved row or a test tells apart from 0, so it is made 0. */
function rulePoints(rule: ScoringRule, area: Area, actions: number): number {
  const points = pointsByShape(rule, area, actions);
  if (!Number.isFinite(points)) throw new Error(`the ${rule.stat} rule gives ${points} points in ${area}`);
  return points === 0 ? 0 : points;
}

function pointsByShape(rule: ScoringRule, area: Area, actions: number): number {
  switch (rule.shape) {
    case "perAction":
      return actions * rule.byArea[area];
    case "perCount": {
      const { every, points } = rule.byArea[area];
      return Math.floor(actions / every) * points;
    }
    case "bands":
      return bandPoints(rule, area, actions);
  }
}

function bandPoints(rule: BandsRule, area: Area, actions: number): number {
  const reached = rule.byArea[area].filter((band) => actions >= band.atLeast);
  if (rule.stack) return sum(reached.map((band) => band.points));
  const highest = reached.toSorted((one, other) => other.atLeast - one.atLeast)[0];
  return highest?.points ?? 0;
}

function sum(numbers: readonly number[]): number {
  return numbers.reduce((total, each) => total + each, 0);
}

/** A league's double-gameweek rule (spec/03): both matches count, or only his best match. */
export type DoubleGameweekRule = "bothMatches" | "bestMatch";

/** A player's gameweek. Provisional while any of his matches' records hasn't arrived: the points
 *  are those of the matches that have, and null while none has. A match still live or inside its
 *  correction window is provisional too, which is the match's own state (spec/07), not this. */
export interface GameweekPoints {
  points: number | null;
  provisional: boolean;
}

/** A player's gameweek from his matches in it, under the league's double-gameweek rule. With one
 *  match the rule changes nothing; with none he scores 0. */
export function scoreGameweek(matches: readonly MatchPoints[], rule: DoubleGameweekRule): GameweekPoints {
  if (rule !== "bothMatches" && rule !== "bestMatch") {
    throw new Error(`a double-gameweek rule of ${JSON.stringify(rule)} is neither both matches nor best match`);
  }
  const arrived = matches.flatMap((match) => (match.total === null ? [] : [match.total]));
  const provisional = arrived.length < matches.length;
  if (matches.length === 0) return { points: 0, provisional };
  if (arrived.length === 0) return { points: null, provisional };
  const points = rule === "bestMatch" ? Math.max(...arrived) : sum(arrived);
  return { points, provisional };
}
