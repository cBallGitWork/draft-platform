import { defineTable } from "convex/server";
import { v } from "convex/values";

// Sign-in (#20, spec/02). Emails are stored trimmed and lower-cased (`normaliseEmail`).

/** An email the admin let sign in (spec/13, Joining). The admin's own email needs no row. */
const allowedEmailFields = { email: v.string() };

/** One ask for a link that was answered "check your email", on the list or not, so the hourly
 *  limit counts every email alike. A refused ask (too many, or paused) is told so and not stored;
 *  one for something that can't be an address is answered the same, but not stored either. Kept
 *  for `SIGN_IN_ASKS_KEPT_MS` (signInLinks.ts). */
const signInAskFields = {
  email: v.string(),
  askedAt: v.number(),
  /** Whether the email was on the list, so a link was to be sent. */
  listed: v.boolean(),
  /** When Convex Auth's send took this ask; a send with no ask to take is refused. */
  claimedAt: v.optional(v.number()),
  /** Why the email wasn't sent, when it wasn't. */
  sendError: v.optional(v.string()),
};

/** The emails the app sent on one UTC day, against Resend's daily limit (ARCHITECTURE.md). */
const emailSendFields = { day: v.string(), count: v.number() };

export const signInTables = {
  allowedEmails: defineTable(allowedEmailFields).index("by_email", ["email"]),
  signInAsks: defineTable(signInAskFields)
    .index("by_email_and_askedAt", ["email", "askedAt"])
    .index("by_askedAt", ["askedAt"]),
  emailSends: defineTable(emailSendFields).index("by_day", ["day"]),
  /** Each person's own time zone, as their browser last named it, so what they read tells time
   *  in it (#442). One row per email. */
  timeZones: defineTable({ email: v.string(), zone: v.string() }).index("by_email", ["email"]),
};
