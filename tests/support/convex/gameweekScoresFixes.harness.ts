// The site's scoring-set fixes the scores league's tests make (gameweekScores.harness.ts): a rule on
// a stat no record holds, and a goal adjusted in the role Hull's scorer plays.

import { roleIn } from "../../../convex/lineup/roles";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import type { StoredScoringSet } from "../../../convex/scoring/scoringSetShape";
import { HULL_SCORER, HULL_STARTERS, type ScoresLeague } from "./gameweekScores.harness";
import { holdSiteScoring } from "./siteScoring.harness";

/** A stat no record holds: a typo of goals_scored. */
export const TYPO_STAT = "goals_scroed";

/** The site's set from now on, a fix in force from the start: `scoring` in place of the first. */
const holdFix = ({ t }: Pick<ScoresLeague, "t">, scoring: StoredScoringSet) =>
  t.run((ctx) => holdSiteScoring(ctx, { scoring, kind: "fix", season: 2026, number: 1, at: 0 }));

/** The site's set from now on holds a rule on TYPO_STAT, as a set written by hand could (#287). */
export async function holdTypoRule(league: Pick<ScoresLeague, "t">) {
  const [rule] = FIRST_SCORING.rules;
  await holdFix(league, { ...FIRST_SCORING, rules: [...FIRST_SCORING.rules, { ...rule, stat: TYPO_STAT }] });
}

/** The first set's goal for HULL_SCORER, a midfielder. */
export const MIDFIELD_GOAL = 5;

/** The site's set from now on adjusts a goal by `points` in the role HULL_SCORER plays: his slot's
 *  first, since his saved lineup gives him none. */
export async function adjustScorersRole(league: ScoresLeague, points: number) {
  const scorer = HULL_STARTERS.find((starter) => starter.playerCode === HULL_SCORER)!;
  const role = roleIn(scorer, undefined).key;
  await holdFix(league, { ...FIRST_SCORING, roleAdjustments: [{ role, adjustments: [{ stat: "goals_scored", points }] }] });
}
