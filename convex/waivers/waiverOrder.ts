import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { draftOrderOf } from "../draft/draftOrder";
import type { LeagueRules } from "../rules/leagueRulesShape";
import type { SeasonRules } from "../rules/rulesHistory";
import { teamsOf } from "../shared/leagueAccess";
import { standingsOf } from "../table/leagueTable";
import { tableOf } from "../table/sentTables";

// The waiver order (#1198, spec/08 Waivers and free agency): who a run tries first. Its starting
// order is the reverse of the table, the bottom first, under reverse table order (the default), or
// the reverse of the draft order under rotating. Each team that wins a claim goes to the bottom, the
// latest winner last. Under rotating that never resets ("whoever last made a waiver is at the
// bottom, that doesnt reset"); under reverse table order it does once a gameweek ends ("the table
// order resets only fully only when a gameweek ends"). There is always a table, everyone on 0 at
// the start; teams level in it go by its own tie-breaks, then by the reverse of the draft order.

/** The league's waiver order row, or null before any run. */
export function waiverOrderRow(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"waiverOrders"> | null> {
  return ctx.db
    .query("waiverOrders")
    .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
    .unique();
}

/** `start` with each of `winners` moved to the bottom, the latest last. A winner no longer in the
 *  league is passed over. Pure. */
export function withWinnersLast<Team>(start: readonly Team[], winners: readonly Team[]): Team[] {
  const won = new Set(winners);
  return [...start.filter((team) => !won.has(team)), ...winners.filter((team) => start.includes(team))];
}

/** `winners` with `team` as the latest. Pure. */
export const wonBy = <Team>(winners: readonly Team[], team: Team): Team[] => [...winners.filter((each) => each !== team), team];

/** Which winners still count at a run, with the latest gameweek begun now: under reverse table
 *  order, none once a gameweek has begun since they were written. Pure. */
export function winnersNow<Team>(
  order: LeagueRules["waivers"]["order"],
  held: { winners: readonly Team[]; gameweek: number | null } | null,
  gameweek: number | null,
): Team[] {
  if (held === null) return [];
  return order === "reverseStandings" && held.gameweek !== gameweek ? [] : [...held.winners];
}

/** The league's waiver order at a run before any of its claims are tried, first first, given the
 *  winners that still count. */
export async function waiverOrderOf(
  ctx: QueryCtx,
  league: Doc<"leagues">,
  season: SeasonRules,
  winners: readonly Id<"teams">[],
): Promise<Id<"teams">[]> {
  const draftOrder = draftOrderOf(await teamsOf(ctx, league._id), league.draftOrder).map(({ _id }) => _id);
  if (season.latest.waivers.order === "rotating") return withWinnersLast(draftOrder.toReversed(), winners);
  const { rules, schedule, scores } = await standingsOf(ctx, league, season);
  // Teams still level after the table's tie-breaks keep the order they come in: the draft order,
  // so reversed they go by its reverse.
  const table = tableOf(rules.format, draftOrder, schedule, scores, rules.tieBreaks);
  return withWinnersLast(table.map(({ team }) => team).toReversed(), winners);
}
