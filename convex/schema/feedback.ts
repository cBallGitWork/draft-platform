import { defineTable } from "convex/server";
import { v } from "convex/values";

// Feedback to the admin (#357, spec/15): one row a message, kept for him to read on his dashboard.
export const feedbackTables = {
  feedback: defineTable({
    /** Who sent it, by email. */
    from: v.string(),
    at: v.number(),
    message: v.string(),
  }).index("by_at", ["at"]),
};
