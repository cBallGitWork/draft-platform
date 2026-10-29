import { v, type Infer } from "convex/values";
import { SLOT_POSITIONS } from "../lineup/pitch";
import { byArea, objectOf, type RequiredValidator } from "../lineup/pitchShape";

// The shape the site's scoring set is stored in (spec/14, Who owns it; siteScoring.ts): scoringSet.ts's
// ScoringSet, so a stored set passes straight into scoring.ts. A league's rules held it until #354,
// and rows saved before then still carry it (../rules/leagueRulesShape.ts, storedLeagueRulesShape).

/** The same validator for each position a slot can be: scoringSet.ts's ByPosition<Value>. */
function byPosition<Value extends RequiredValidator>(value: Value) {
  return objectOf(SLOT_POSITIONS, value);
}

/** scoringSet.ts's Priced<Value>: the same for all, by area, or by position. */
function priced<Value extends RequiredValidator>(value: Value) {
  return v.union(v.object({ all: value }), v.object({ byArea: byArea(value) }), v.object({ byPosition: byPosition(value) }));
}

const band = v.object({ atLeast: v.number(), points: v.number() });

/** What any rule may carry besides its values: scoringSet.ts's RuleOptions. */
const ruleOptions = {
  limit: v.optional(priced(v.object({ max: v.union(v.number(), v.null()), min: v.union(v.number(), v.null()) }))),
  minMinutes: v.optional(priced(v.number())),
};

/** scoringSet.ts's ScoringSet. */
export const scoringSetShape = v.object({
  rules: v.array(
    v.union(
      v.object({ shape: v.literal("perAction"), stat: v.string(), values: priced(v.number()), ...ruleOptions }),
      v.object({
        shape: v.literal("perCount"),
        stat: v.string(),
        values: priced(v.object({ every: v.number(), points: v.number() })),
        ...ruleOptions,
      }),
      v.object({ shape: v.literal("bands"), stat: v.string(), stack: v.boolean(), values: priced(v.array(band)), ...ruleOptions }),
    ),
  ),
  wholePointsOnly: v.boolean(),
  /** scoringSet.ts's OwnStat. */
  ownStats: v.optional(
    v.array(
      v.object({
        stat: v.string(),
        name: v.string(),
        shortCode: v.string(),
        parts: v.array(v.object({ stat: v.string(), weight: v.number() })),
      }),
    ),
  ),
  /** scoringSet.ts's RoleAdjustments (spec/05 Roles; #10). */
  roleAdjustments: v.optional(
    v.array(v.object({ role: v.string(), adjustments: v.array(v.object({ stat: v.string(), points: v.number() })) })),
  ),
});

export type StoredScoringSet = Infer<typeof scoringSetShape>;
