import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { tieBreaksOf } from "../rules/firstRules";
import { changeBySite } from "../rules/siteRulesChange";
import { heldRules, type LeagueRules } from "../rules/leagueRulesShape";
import { everyLeague } from "../shared/cappedRead";
import { TIE_BREAKS } from "../table/standings";

// The one-off for #2266 (Craig, 15 Nov 2026, on #1034): every league has all three tie-breaks, in
// its own order. A league saved with fewer keeps its own first, with the rest added after them
// (tieBreaksOf) from the next gameweek, so a gameweek begun keeps the rules it had
// (../rules/siteRulesChange.ts). The admin's default rules row, which every new league copies, gets them too.
// Running it again does nothing. Run it once on each deployment:
//   npx convex run migrations/everyTieBreak:addEveryTieBreak
//   npx convex run --prod migrations/everyTieBreak:addEveryTieBreak

const withEveryTieBreak = (rules: LeagueRules): LeagueRules => ({ ...rules, tieBreaks: tieBreaksOf(rules) });

/** Adds the missing tie-breaks to every league's rules from its next gameweek, and to the admin's
 *  defaults; returns how many leagues changed and whether the defaults did. */
export const addEveryTieBreak = internalMutation({
  args: {},
  returns: v.object({ leaguesChanged: v.number(), defaultsChanged: v.boolean() }),
  handler: async (ctx) => {
    let leaguesChanged = 0;
    for (const league of await everyLeague(ctx, "so some would keep fewer tie-breaks")) {
      if ((await changeBySite(ctx, league._id, withEveryTieBreak)) !== null) leaguesChanged += 1;
    }
    const defaults = await ctx.db.query("defaultLeagueRules").unique();
    const defaultsChanged = defaults !== null && defaults.rules.tieBreaks.length < TIE_BREAKS.length;
    if (defaultsChanged) await ctx.db.patch("defaultLeagueRules", defaults._id, { rules: withEveryTieBreak(heldRules(defaults.rules)) });
    return { leaguesChanged, defaultsChanged };
  },
});
