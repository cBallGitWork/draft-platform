import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { scheduleEveryLeague, takeAllOrThrow } from "../shared/cappedRead";
import { sameValue } from "../scouting/scoutingPlayers";
import type { LeagueRules } from "./leagueRulesShape";
import { historyOf, RULES_CHANGES_MOST, savedForm } from "./rulesHistory";

// The one-off conversion for #2009 (Part of #1995, the Convex quota): every rules row saved whole
// before #1617, past a league's first, is stored as only the parts it changed on top of the row
// before, as a save stores it since, so each rules read stops copying the formations and classics
// out of every old row. Nothing a manager sees changes: each league's history is read whole before
// and after, and a league whose history would read differently throws, so its rows stay as they
// were. A row whose changes would leave a part out stays whole (`savedForm`). Running it again
// does nothing. Back the deployment up first (`npx convex export`), then run it once on each:
//   npx convex run rules/rulesToChanges:convertEveryLeague
//   npx convex run --prod rules/rulesToChanges:convertEveryLeague

/** The parts in which `rules` differ from `before`, whatever their fields' order. Pure. */
function changedParts(before: LeagueRules, rules: LeagueRules): (keyof LeagueRules)[] {
  const parts = new Set([...Object.keys(before), ...Object.keys(rules)] as (keyof LeagueRules)[]);
  return [...parts].filter((part) => !sameValue(before[part], rules[part]));
}

/** Converts one league's whole rows past its first to changes only; returns how many it converted. */
export const convertLeague = internalMutation({
  args: { leagueId: v.id("leagues") },
  returns: v.number(),
  handler: async (ctx, { leagueId }) => {
    const history = await historyOf(ctx, leagueId);
    const rows = await takeAllOrThrow(
      ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId)),
      RULES_CHANGES_MOST,
      `League ${leagueId} holds more than ${RULES_CHANGES_MOST} rules rows, so some would stay whole`,
    );
    let converted = 0;
    for (const [index, row] of rows.entries()) {
      if (index === 0 || row.rules === undefined) continue;
      const { rules } = history[index];
      const form = savedForm(rules, changedParts(history[index - 1].rules, rules));
      if (!("changes" in form)) continue;
      await ctx.db.replace("leagueRules", row._id, { leagueId, fromGameweek: row.fromGameweek, changes: form.changes });
      converted += 1;
    }
    const after = await historyOf(ctx, leagueId);
    if (!sameValue(after, history)) throw new Error(`League ${leagueId}'s rules would read differently stored as changes, so its rows stay whole`);
    return converted;
  },
});

/** Converts every league's rows, each league in its own transaction, so one that throws leaves the
 *  others converted. */
export const convertEveryLeague = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await scheduleEveryLeague(ctx, internal.rules.rulesToChanges.convertLeague, "so some would keep their whole rules rows");
    return null;
  },
});
