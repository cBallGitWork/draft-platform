import { defineTable } from "convex/server";
import { v } from "convex/values";
import { availability } from "./football";

// The admin's availability over the feed's (spec/06, Availability; spec/15). Kept apart from
// `players`, which the football sync rewrites every six hours, so no feed read touches his say.
// One row per player he has set, keyed on FPL's season-stable `code`; clearing it deletes the row.

export const availabilityTables = {
  availabilitySettings: defineTable({
    code: v.number(),
    availability,
  }).index("by_code", ["code"]),
};
