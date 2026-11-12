import { defineTable } from "convex/server";
import { v } from "convex/values";

/** The emails the app sent on one UTC day, against Resend's daily limit (ARCHITECTURE.md). */
const emailSendFields = { day: v.string(), count: v.number() };

export const outboundTables = {
  emailSends: defineTable(emailSendFields).index("by_day", ["day"]),
};
