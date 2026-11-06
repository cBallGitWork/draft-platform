import { v, type Infer } from "convex/values";
import { SLOT_POSITIONS } from "../lineup/pitch";
import { areaShape } from "../lineup/pitchShape";
import { roleName } from "../lineup/roles";
import type { OwnStat } from "./scoringSet";
import { categoryName } from "./categories";
import type { CategoryPoints, RolePoints } from "./scoring";
import { bandShape } from "./scoringSetShape";

// A match's points breakdown as the screens are sent it (spec/14, On screen: each line says why):
// each category by full name with why, and his role's line. The player card (#797) and the
// matchup's breakdown (#798) send the same lines, so the two never word them apart.

export const slotPosition = v.union(...SLOT_POSITIONS.map((each) => v.literal(each)));

/** scoring.ts's CategoryWhy: what a category's points are made of (spec/14, On screen). */
const categoryWhy = v.object({
  actions: v.number(),
  value: v.union(
    v.object({ shape: v.literal("perAction"), points: v.number() }),
    v.object({ shape: v.literal("perCount"), every: v.number(), points: v.number() }),
    v.object({ shape: v.literal("bands"), earned: v.array(bandShape) }),
  ),
  pricedBy: v.union(
    v.object({ by: v.literal("all") }),
    v.object({ by: v.literal("area"), area: areaShape }),
    v.object({ by: v.literal("position"), position: slotPosition }),
  ),
  cut: v.union(
    v.null(),
    v.object({ by: v.literal("minutes"), atLeast: v.number() }),
    v.object({ by: v.union(v.literal("max"), v.literal("min"), v.literal("atMax"), v.literal("atMin")), limit: v.number() }),
  ),
});

/** Each of the set's categories, by full name, in its order: its points and why, or null points
 *  while his whole record hasn't arrived. */
export const namedCategories = v.array(
  v.union(
    v.object({ stat: v.string(), name: v.string(), points: v.null() }),
    v.object({ stat: v.string(), name: v.string(), points: v.number(), why: categoryWhy }),
  ),
);
export type NamedCategories = Infer<typeof namedCategories>;

/** His role's points (spec/05; Craig, 5 Nov 2026: "Poacher: +1 (+2: 1 goal in box, 1 shot on target
 *  in box; −1: 1 big chance missed)"): its name, its net, and each side that moved him with each of
 *  its stats he made. */
export const roleLine = v.object({
  name: v.string(),
  points: v.number(),
  sides: v.array(v.object({ points: v.number(), lines: v.array(v.object({ stat: v.string(), name: v.string(), actions: v.number() })) })),
});
export type RoleLine = Infer<typeof roleLine>;

/** The categories, each named as the set names its stat. */
export function namedCategoriesOf(categories: readonly CategoryPoints[], ownStats: readonly OwnStat[] | undefined) {
  return categories.map((each) => ({ ...each, name: categoryName(each.stat, ownStats) }));
}

/** The role's line, its role and each stat named. */
export function roleLineOf(role: RolePoints, ownStats: readonly OwnStat[] | undefined) {
  return {
    name: roleName(role.role),
    points: role.points,
    sides: role.sides.map(({ points, lines }) => ({ points, lines: lines.map((line) => ({ ...line, name: categoryName(line.stat, ownStats) })) })),
  };
}
