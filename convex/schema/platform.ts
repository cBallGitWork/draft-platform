import { defineTable } from "convex/server";
import { v } from "convex/values";
import { approveMode } from "./positions";

// The platform's own settings, the admin's to change (spec/15; admin/platformSettings.ts): every
// platform-wide setting lives here, one row per setting (#200), so none gets a table of its own. A
// league's rules are never here. Positions from starts' settings (spec/06) moved here from their
// own one-row table, positionSettings, which goes once positions/positionSettingsMove.ts has run.

/** A setting on the admin's dashboard form (spec/15). */
export const platformSettingName = v.union(
  v.literal("statCorrectionWindowMinutes"),
  v.literal("scoutsPerTeam"),
  v.literal("matchdayHoursBefore"),
  v.literal("matchdayHoursAfter"),
);

/** How many starts in a row elsewhere flag a position from starts, and remove it (spec/06). */
const positionsThresholdName = v.union(v.literal("positionsFlagAfter"), v.literal("positionsRemoveAfter"));

export const platformTables = {
  platformSettings: defineTable(
    v.union(
      v.object({ name: v.union(platformSettingName, positionsThresholdName), value: v.number() }),
      /** Whether positions from starts wait for the admin or count at once (spec/06). */
      v.object({ name: v.literal("positionsApproveMode"), value: approveMode }),
    ),
  ).index("by_name", ["name"]),
};
