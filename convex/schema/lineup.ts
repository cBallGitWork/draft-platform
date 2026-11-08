import { defineTable } from "convex/server";
import { v } from "convex/values";
import { instructionPairShape } from "../lineup/instructionsShape";
import { cellShape } from "../lineup/pitchShape";

// Each team's lineup (#8, spec/05): one row for each gameweek it was saved from, its first
// lineup's included, which lineup/lineups.ts picks again on each squad change until the manager
// saves; lineup/lineups.ts writes and reads them.

/** A starter and the cell he stands in: lineup.ts's Placement, its cell checked. */
export const placementShape = cellShape.extend({
  playerCode: v.number(),
  /** The role he plays (lineup/roles.ts), absent until given: the slot's first (#10). */
  role: v.optional(v.string()),
});

/** A slot of a saved plan: its cell and the role it plays. */
export const planSlotShape = cellShape.extend({ role: v.string() });

export const lineupTables = {
  lineups: defineTable({
    leagueId: v.id("leagues"),
    teamId: v.id("teams"),
    fromGameweek: v.number(),
    starters: v.array(placementShape),
    /** Player codes, in the order auto-subs use. */
    bench: v.array(v.number()),
    /** True while it is the team's first lineup, picked from its squad and picked again as the
     *  squad changes (lineups.ts); absent once its manager has saved one. */
    firstLineup: v.optional(v.literal(true)),
    /** The classic its manager picked (lineup/classics.ts), its name, until he picks another
     *  formation; its starters and instructions say whether he has changed it since (#991). */
    classic: v.optional(v.string()),
    /** The team's attacking and defensive instruction by key (spec/05, Team instructions; #990);
     *  absent until its manager picks: the formation's defaults (lineup/instructions.ts). */
    instructions: v.optional(instructionPairShape),
  }).index("by_leagueId_and_teamId_and_fromGameweek", ["leagueId", "teamId", "fromGameweek"]),
  /** Each team's saved plans (spec/05, Saved plans; #992): a formation and every slot's role, by
   *  name, never players. lineup/savedPlans.ts writes and reads them. */
  savedPlans: defineTable({
    leagueId: v.id("leagues"),
    teamId: v.id("teams"),
    name: v.string(),
    /** One per starter's slot, each with the role it plays (lineup/roles.ts). */
    slots: v.array(planSlotShape),
    /** Its attacking and defensive instruction by key (spec/05, Saved plans; #990): absent from a
     *  plan saved before them, which loads as a formation change does (lineup/instructions.ts). */
    instructions: v.optional(instructionPairShape),
  }).index("by_leagueId_and_teamId_and_name", ["leagueId", "teamId", "name"]),
};
