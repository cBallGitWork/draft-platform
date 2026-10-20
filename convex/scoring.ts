// A player's points for one match under a league's scoring set (spec/14, How a rule scores; #29).
// The scoring set is the league's rule, so it is always an argument, never a constant.

/** The pitch's six areas, back to front (spec/05). */
export const AREAS = ["goalkeeper", "defence", "defensiveMidfield", "midfield", "attackingMidfield", "attack"] as const;
export type Area = (typeof AREAS)[number];

/** A value for each of the six areas: a league sets every rule's values per area. */
export type ByArea<Value> = Readonly<Record<Area, Value>>;

/** Points for reaching a number of actions: 2 for 60 or more minutes is `{ atLeast: 60, points: 2 }`. */
export interface Band {
  atLeast: number;
  points: number;
}

/** +3 per assist: the action's points, times how many he made. */
export interface PerActionRule {
  shape: "perAction";
  stat: string;
  byArea: ByArea<number>;
}

/** +1 per 3 saves: the points for each whole `every` actions he made. */
export interface PerCountRule {
  shape: "perCount";
  stat: string;
  byArea: ByArea<{ every: number; points: number }>;
}

/** 2 for 60+ minutes, +2 for 10+ defensive actions: each band he reaches pays when the rule
 *  stacks, or only the highest he reaches when it doesn't. An area with no bands pays nothing. */
export interface BandsRule {
  shape: "bands";
  stat: string;
  stack: boolean;
  byArea: ByArea<readonly Band[]>;
}

/** One rule prices one category. `stat` is the category's key in a player's match record. */
export type ScoringRule = PerActionRule | PerCountRule | BandsRule;

/** A league's scoring set: what #25 stores. A stat no rule names scores nothing, FPL's bonus among them. */
export interface ScoringSet {
  rules: readonly ScoringRule[];
}

/** A player's stats for one match, by the feeds' own keys. */
export type MatchRecord = Readonly<Record<string, number>>;

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
 * Once it has arrived, a stat it leaves out is 0 (spec/14).
 */
export function scoreMatch(record: MatchRecord | null, set: ScoringSet, area: Area): MatchPoints {
  if (record === null) {
    return { total: null, categories: set.rules.map((rule) => ({ stat: rule.stat, points: null })) };
  }
  const categories = set.rules.map((rule) => ({
    stat: rule.stat,
    points: rulePoints(rule, area, statIn(record, rule.stat)),
  }));
  return { total: sum(categories.map((category) => category.points)), categories };
}

/** Only the record's own keys count: a rule on `constructor` must not read Object's. */
function statIn(record: MatchRecord, stat: string): number {
  return Object.hasOwn(record, stat) ? record[stat] : 0;
}

/** A rule lacking its area's values, or giving a non-number, is bad data, and throws. No action
 *  under a negative rule (0 yellow cards at -1) is -0 in JavaScript, which a saved row or a test
 *  tells apart from 0, so it is made 0. */
function rulePoints(rule: ScoringRule, area: Area, actions: number): number {
  if (!Object.hasOwn(rule.byArea, area)) throw new Error(`the ${rule.stat} rule has no values for ${area}`);
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
      if (!(every > 0)) {
        throw new Error(`the ${rule.stat} rule pays for every ${every} actions in ${area}; it must be more than 0`);
      }
      return Math.floor(actions / every) * points;
    }
    case "bands":
      return bandPoints(rule, area, actions);
    default: {
      const shape = JSON.stringify((rule as { shape: unknown }).shape);
      throw new Error(`a scoring rule of shape ${shape} is not one of the three`);
    }
  }
}

function bandPoints(rule: BandsRule, area: Area, actions: number): number {
  const bands = rule.byArea[area];
  if (new Set(bands.map((band) => band.atLeast)).size !== bands.length) {
    throw new Error(`the ${rule.stat} rule has two bands at one threshold in ${area}`);
  }
  const reached = bands.filter((band) => actions >= band.atLeast);
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
