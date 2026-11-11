import { defineTable } from "convex/server";
import { v } from "convex/values";

/** The platform's own settings, the admin's to change (spec/15). A league's rules are never here. */
export const platformSettingName = v.union(
  v.literal("statCorrectionWindowMinutes"),
  v.literal("scoutsPerTeam"),
  v.literal("matchdayHoursBefore"),
  v.literal("matchdayHoursAfter"),
);

export const platformSettingsTables = {
  platformSettings: defineTable({ name: platformSettingName, value: v.number() }).index("by_name", ["name"]),
};
