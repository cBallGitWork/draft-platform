import { defineTable } from "convex/server";
import { v } from "convex/values";

// Mail (#26, spec/16). A letter is filed as one row for each person it's to, so who got it is
// fixed when it's filed: someone who joins later doesn't get the league's old letters.

export const letterFields = {
  /** Whom this copy is to, by email. */
  to: v.string(),
  /** The league it is from; absent on a letter from the site to everyone, such as a patch to its
   *  scoring (#356), which no league's deletion takes with it. */
  leagueId: v.optional(v.id("leagues")),
  /** The league's name when it was filed; absent with `leagueId`. */
  leagueName: v.optional(v.string()),
  at: v.number(),
  /** Who wrote it, by email: absent on a letter the app files about something that happened. */
  from: v.optional(v.string()),
  subject: v.string(),
  body: v.string(),
  /** When `to` opened it; absent while unread. */
  readAt: v.optional(v.number()),
};

export const mailTables = {
  letters: defineTable(letterFields)
    .index("by_to_and_at", ["to", "at"])
    .index("by_to_and_readAt", ["to", "readAt"])
    .index("by_leagueId", ["leagueId"]),
};

// Feedback to the admin (#357, spec/15): one row a message, kept for him to read on his dashboard.
export const feedbackTables = {
  feedback: defineTable({
    /** Who sent it, by email. */
    from: v.string(),
    at: v.number(),
    message: v.string(),
  }).index("by_at", ["at"]),
};
