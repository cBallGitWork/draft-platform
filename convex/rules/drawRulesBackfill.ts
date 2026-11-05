import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { LEAGUES_READ_MOST, takeAllOrThrow } from "../shared/cappedRead";
import { drawRulesOf } from "./firstRules";
import { RULES_CHANGES_MOST } from "./rulesHistory";

// The backfill step of #147 (ARCHITECTURE.md's Data, "Changing a saved shape"): every rules row
// saved before #33 and #130 gets the odd team out and games a gameweek it already plays by
// (`drawRulesOf`, the first rules'), so no league's draw moves. Once it has run on each deployment,
// both fields can be made required and `drawRulesOf`'s fallbacks dropped. A row holding both is
// left alone, so running it again does nothing. Run it once on each deployment:
//   npx convex run rules/drawRulesBackfill:fillDrawRules
//   npx convex run --prod rules/drawRulesBackfill:fillDrawRules

type StoredRules = Doc<"leagueRules">["rules"];

/** The rules with the draw rules they play by written in, or null if they hold both already. */
function filled(rules: StoredRules): StoredRules | null {
  if (rules.oddTeamOut !== undefined && rules.gamesPerGameweek !== undefined) return null;
  return { ...rules, ...drawRulesOf(rules) };
}

/** Fills the odd team out and games a gameweek into every league's rules rows and the admin's
 *  default rules that lack them; returns how many of each it filled. */
export const fillDrawRules = internalMutation({
  args: {},
  returns: v.object({ leagueRows: v.number(), defaultRows: v.number() }),
  handler: async (ctx) => {
    const leagues = await takeAllOrThrow(
      ctx.db.query("leagues"),
      LEAGUES_READ_MOST,
      `More than ${LEAGUES_READ_MOST} leagues are held, so some rules would be left without their draw rules`,
    );
    let leagueRows = 0;
    for (const league of leagues) {
      const rows = await takeAllOrThrow(
        ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", league._id)),
        RULES_CHANGES_MOST,
        `League ${league._id} holds more than ${RULES_CHANGES_MOST} rules rows, so some would be left without their draw rules`,
      );
      for (const row of rows) {
        const rules = filled(row.rules);
        if (rules === null) continue;
        await ctx.db.patch("leagueRules", row._id, { rules });
        leagueRows += 1;
      }
    }
    // The admin's default rules are one row (schema/rules.ts).
    const defaults = await ctx.db.query("defaultLeagueRules").first();
    const defaultRules = defaults === null ? null : filled(defaults.rules);
    if (defaults !== null && defaultRules !== null) await ctx.db.patch("defaultLeagueRules", defaults._id, { rules: defaultRules });
    return { leagueRows, defaultRows: defaultRules === null ? 0 : 1 };
  },
});
