import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { tieBreaksOf } from "../rules/firstRules";
import { changeBySite } from "../rules/siteRulesChange";
import { heldRules, type LeagueRules } from "../rules/leagueRulesShape";
import { scheduleEveryLeague } from "../shared/cappedRead";
import { TIE_BREAKS } from "../table/standings";

// The one-off for #2266 (Craig, 15 Nov 2026, on #1034): every league has all three tie-breaks, in
// its own order. A league saved with fewer keeps its own first, with the rest added after them
// (tieBreaksOf) from the next gameweek, so a gameweek begun keeps the rules it had
// (../rules/siteRulesChange.ts). The admin's default rules row, which every new league copies, gets them too.
// Each league changes in its own transaction (scheduleEveryLeague), so one that throws, such as a
// league already holding the most rules changes, leaves every other league's change standing and
// its own error, naming it, in the deployment's logs. Running it again does nothing. Run it once on
// each deployment:
//   npx convex run migrations/everyTieBreak:addEveryTieBreak
//   npx convex run --prod migrations/everyTieBreak:addEveryTieBreak

const withEveryTieBreak = (rules: LeagueRules): LeagueRules => ({ ...rules, tieBreaks: tieBreaksOf(rules) });

/** Adds the missing tie-breaks to one league's rules; returns the gameweek they start from, or null
 *  when the league already had all three. */
export const addLeagueTieBreaks = internalMutation({
  args: { leagueId: v.id("leagues") },
  returns: v.union(v.number(), v.null()),
  handler: (ctx, { leagueId }) => changeBySite(ctx, leagueId, withEveryTieBreak),
});

/** Adds the missing tie-breaks to the admin's defaults, and schedules each league's change in its
 *  own transaction; returns whether the defaults changed. */
export const addEveryTieBreak = internalMutation({
  args: {},
  returns: v.object({ defaultsChanged: v.boolean() }),
  handler: async (ctx) => {
    await scheduleEveryLeague(ctx, internal.migrations.everyTieBreak.addLeagueTieBreaks, "so some would keep fewer tie-breaks");
    const defaults = await ctx.db.query("defaultLeagueRules").unique();
    const defaultsChanged = defaults !== null && defaults.rules.tieBreaks.length < TIE_BREAKS.length;
    if (defaultsChanged) await ctx.db.patch("defaultLeagueRules", defaults._id, { rules: withEveryTieBreak(heldRules(defaults.rules)) });
    return { defaultsChanged };
  },
});
