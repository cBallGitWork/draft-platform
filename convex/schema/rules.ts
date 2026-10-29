import { defineTable } from "convex/server";
import { v } from "convex/values";
import { storedLeagueRulesShape } from "../rules/leagueRulesShape";
import { squadMaximumBandShape } from "../rules/squadMaximums";

// A league's rules (#25, spec/03). Each change is a new row from the gameweek it takes effect, so
// past gameweeks keep the rules they were played under; who changed them is in leagueEvents.
export const leagueRulesTables = {
  leagueRules: defineTable({ leagueId: v.id("leagues"), fromGameweek: v.number(), rules: storedLeagueRulesShape }).index(
    "by_leagueId_and_fromGameweek",
    ["leagueId", "fromGameweek"],
  ),
  /** One row: the rules the admin gives each new league. */
  defaultLeagueRules: defineTable({ rules: storedLeagueRulesShape }),
};

export const squadMaximumTables = {
  /** One row: the squad maximum a new league takes by its size, which Craig edits (#316). */
  squadMaximums: defineTable({ bands: v.array(squadMaximumBandShape) }),
};
