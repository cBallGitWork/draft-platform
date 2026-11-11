import { defineTable } from "convex/server";
import { v } from "convex/values";
import { rulesChangesShape, storedLeagueRulesShape } from "../rules/leagueRulesShape";
import { squadMaximumBandShape } from "../rules/squadMaximums";

// A league's rules (#25, spec/03). Each change is a new row from the gameweek it takes effect, so
// past gameweeks keep the rules they were played under; who changed them is in leagueEvents.
// A row holds the whole rules (a league's first, every row saved before #1617, and a save leaving
// a part out) or only the parts its save changed, on top of the row before it (rulesHistory.ts).
export const leagueRulesTables = {
  leagueRules: defineTable({
    leagueId: v.id("leagues"),
    fromGameweek: v.number(),
    rules: v.optional(storedLeagueRulesShape),
    changes: v.optional(rulesChangesShape),
  }).index("by_leagueId_and_fromGameweek", ["leagueId", "fromGameweek"]),
  /** One row: the rules the admin gives each new league. */
  defaultLeagueRules: defineTable({ rules: storedLeagueRulesShape }),
};

export const squadMaximumTables = {
  /** One row: the squad maximum a new league takes by its size, which Craig edits (#316). */
  squadMaximums: defineTable({ bands: v.array(squadMaximumBandShape) }),
};
