import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { instructionsOf } from "../rules/firstRules";
import { latestRules } from "../rules/rulesHistory";
import { managerOf, refuse } from "../shared/leagueAccess";
import { planSlotShape } from "../schema/lineup";
import { pairRefusal } from "./instructions";
import { instructionPairShape } from "./instructionsShape";
import { pairRefusalWords } from "./instructionsWords";
import { STARTER_COUNT } from "./lineup";
import { PLAN_NAME_MOST, PLANS_KEPT, planRefusals } from "./lineupWords";
import { cellKey, isOnPitch, type Area, type Lane } from "./pitch";
import { roleIn } from "./roles";

// A manager's saved plans (spec/05, Saved plans; #992): a formation, every slot's role and both
// team instructions (#990), saved by name, never players ("Players change too much to save"). He
// keeps up to 5; saving under a name he already has replaces that plan, and a plan he deletes is
// gone (Craig, 6 Nov 2026). Whether a plan may still be loaded under the league's rules is the screen's, read against the presets of the
// gameweek it edits (src/myTeam/tactics/lineupEdits.ts `loadedPlan`).

const planShape = v.object({ name: v.string(), slots: v.array(planSlotShape), instructions: v.optional(instructionPairShape) });

/** A plan's slots as the browser sends them, cells and roles still unchecked. */
const sentSlots = v.array(v.object({ area: v.string(), lane: v.string(), role: v.optional(v.string()) }));

/** The team's plans, or its plan by `name`. */
const plansOf = (ctx: QueryCtx, leagueId: Id<"leagues">, teamId: Id<"teams">, name?: string) =>
  ctx.db.query("savedPlans").withIndex("by_leagueId_and_teamId_and_name", (q) => {
    const team = q.eq("leagueId", leagueId).eq("teamId", teamId);
    return name === undefined ? team : team.eq("name", name);
  });

/** The caller's own team's plans, oldest saved first; a replaced plan keeps its place. */
export const mine = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(planShape),
  handler: async (ctx, { leagueId }) => {
    const { team } = await managerOf(ctx, leagueId);
    // save refuses a sixth, so a team never holds more than PLANS_KEPT: the bound cuts nothing.
    const rows = await plansOf(ctx, leagueId, team._id).take(PLANS_KEPT);
    return rows.toSorted((one, other) => one._creationTime - other._creationTime).map(({ name, slots, instructions }) => ({ name, slots, ...(instructions !== undefined && { instructions }) }));
  },
});

/** Saves the slots as the caller's plan `name` (its spaces trimmed), replacing the one he has by
 *  that name. Refused for a name outside 1 to 30 characters, slots that aren't eleven cells of the
 *  pitch, a pair of instructions the league's latest rules don't offer on those cells, or a sixth
 *  plan. A role the slot's position doesn't hold is saved as the one it plays. */
export const save = mutation({
  args: { leagueId: v.id("leagues"), name: v.string(), slots: sentSlots, instructions: v.optional(instructionPairShape) },
  returns: v.null(),
  handler: async (ctx, { leagueId, name: typed, slots: sent, instructions }) => {
    const { team } = await managerOf(ctx, leagueId);
    const name = typed.trim();
    if (name.length === 0 || name.length > PLAN_NAME_MOST) refuse(planRefusals.nameLength);
    const cells = sent.map(({ area, lane }) => ({ area: area as Area, lane: lane as Lane }));
    const eleven = cells.length === STARTER_COUNT && new Set(cells.map(cellKey)).size === STARTER_COUNT;
    if (!eleven || !cells.every(isOnPitch)) refuse(planRefusals.notEleven);
    const slots = cells.map((cell, index) => ({ ...cell, role: roleIn(cell, sent[index].role).key }));
    if (instructions !== undefined) {
      const set = instructionsOf(await latestRules(ctx, leagueId));
      const refusal = pairRefusal(instructions, cells, set);
      if (refusal !== null) refuse(pairRefusalWords(refusal, set));
    }

    const existing = await plansOf(ctx, leagueId, team._id, name).unique();
    if (existing !== null) await ctx.db.patch("savedPlans", existing._id, { slots, instructions });
    else if ((await plansOf(ctx, leagueId, team._id).take(PLANS_KEPT)).length >= PLANS_KEPT) refuse(planRefusals.full);
    else await ctx.db.insert("savedPlans", { leagueId, teamId: team._id, name, slots, ...(instructions !== undefined && { instructions }) });
    return null;
  },
});

/** Deletes the caller's plan `name`; one he has no plan by is already gone. */
export const remove = mutation({
  args: { leagueId: v.id("leagues"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, { leagueId, name }) => {
    const { team } = await managerOf(ctx, leagueId);
    const existing = await plansOf(ctx, leagueId, team._id, name).unique();
    if (existing !== null) await ctx.db.delete("savedPlans", existing._id);
    return null;
  },
});
