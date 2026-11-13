import { defineTable } from "convex/server";
import { v } from "convex/values";

// Feedback to the admin (#357, spec/15): one row a message, kept for him to read on his dashboard
// until he deletes it (#395).
export const feedbackTables = {
  feedback: defineTable({
    /** Who sent it, by email. */
    from: v.string(),
    at: v.number(),
    message: v.string(),
    /** When the admin marked it read (#395); absent while unread. */
    readAt: v.optional(v.number()),
  })
    .index("by_at", ["at"])
    // How many one person sent in the last day, for the daily limit (#395).
    .index("by_from_and_at", ["from", "at"]),
};
