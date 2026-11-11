import { defineTable } from "convex/server";
import { v } from "convex/values";

// The platform's own settings, the admin's to change (spec/15; admin/platformSettings.ts). A
// league's rules are never here. One home for every platform-wide setting is #200.

/** A platform setting's name. */
export const platformSettingName = v.union(
  v.literal("statCorrectionWindowMinutes"),
  v.literal("scoutsPerTeam"),
  v.literal("matchdayHoursBefore"),
  v.literal("matchdayHoursAfter"),
);

export const platformTables = {
  platformSettings: defineTable({ name: platformSettingName, value: v.number() }).index("by_name", ["name"]),
};
