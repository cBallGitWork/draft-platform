import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { changesFromAt } from "../gameweeks/nextGameweek";
import { changedParts, changesFromTimesOf, rulesRefusals } from "./leagueRules";
import type { LeagueRules } from "./leagueRulesShape";
import { historyOf, newestRow, RULES_CHANGES_MOST, savedForm } from "./rulesHistory";

// A change the site makes to a league's rules, not its commissioner: a one-off in ../migrations/
// (everyTieBreak.ts, #2266). It takes effect from the gameweek a commissioner's change saved now
// would (leagueRules.ts's `changesFromTimesOf`), so no gameweek begun changes, and files no letter.

/** Saves the league's latest rules with `changed` applied from that gameweek, and returns it, or
 *  null when `changed` changes nothing. Throws for a league already holding the most changes. */
export async function changeBySite(ctx: MutationCtx, leagueId: Id<"leagues">, changed: (latest: LeagueRules) => LeagueRules): Promise<number | null> {
  const history = await historyOf(ctx, leagueId);
  const { rules: latest } = newestRow(history, leagueId);
  const rules = changed(latest);
  const parts = changedParts(latest, rules);
  if (parts.length === 0) return null;
  if (history.length >= RULES_CHANGES_MOST) throw new Error(`League ${leagueId}: ${rulesRefusals.tooManyChanges}`);
  const fromGameweek = changesFromAt(await changesFromTimesOf(ctx, leagueId, history, rules), Date.now());
  await ctx.db.insert("leagueRules", { leagueId, fromGameweek, ...savedForm(rules, parts) });
  return fromGameweek;
}
