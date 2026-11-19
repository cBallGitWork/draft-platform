import { defineTable } from "convex/server";
import { v } from "convex/values";

// The Guide (spec/23): its sections down the left and each section's entries, held as data so the
// admin edits them on his dashboard without a build (S23.13), and an edit shows at once (S23.15).
export const guideTables = {
  guideSections: defineTable({
    title: v.string(),
    /** Where it stands down the left: 0 first, with no gaps. */
    order: v.number(),
  }).index("by_order", ["order"]),
  guideEntries: defineTable({
    sectionId: v.id("guideSections"),
    title: v.string(),
    /** Plain text for now (S23.9). */
    text: v.string(),
    /** Where it stands in its section: 0 first, with no gaps. */
    order: v.number(),
  }).index("by_section_and_order", ["sectionId", "order"]),
};
