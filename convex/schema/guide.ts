import { defineTable } from "convex/server";
import { v } from "convex/values";
import { formationKind } from "../guide/formationEntries";

// The Guide (spec/23): its sections down the left and each section's entries, held as data so the
// admin edits them on his dashboard without a build (S23.13), and an edit shows at once (S23.15).
export const guideTables = {
  guideSections: defineTable({
    title: v.string(),
    /** Where it stands down the left: 0 first, with no gaps. */
    order: v.number(),
    /** Set on Tactics alone: the section the formation entries are listed in (S23.7). */
    holdsFormations: v.optional(v.literal(true)),
  }).index("by_order", ["order"]),
  guideEntries: defineTable({
    sectionId: v.id("guideSections"),
    title: v.string(),
    /** Plain text for now (S23.9). */
    text: v.string(),
    /** Where it stands in its section: 0 first, with no gaps. */
    order: v.number(),
  }).index("by_section_and_order", ["sectionId", "order"]),
  /** The admin's edit to a formation's or classic side's entry, by its name: the one held
   *  description the Guide and the formation window both show (S23.7, S05.61), and its place among
   *  Tactics' formation entries. A formation with no row shows Claude's description, at the foot. */
  guideFormationEntries: defineTable({
    kind: formationKind,
    name: v.string(),
    text: v.optional(v.string()),
    order: v.optional(v.number()),
  }).index("by_kind_and_name", ["kind", "name"]),
};
