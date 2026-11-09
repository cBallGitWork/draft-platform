import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { draftOrderOf } from "../draft/draftOrder";
import type { LeagueDeadlines } from "../gameweeks/deadline";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { WAIVER_ORDERS, type LeagueRules } from "../rules/leagueRulesShape";
import { seasonRules, type SeasonRules } from "../rules/rulesHistory";
import { memberOf, teamsOf } from "../shared/leagueAccess";
import { standingsOf } from "../table/leagueTable";
import { tableOf } from "../table/sentTables";
import { inWaiverLock, latestBegun } from "./waiverLock";
import { firstRunFrom } from "./waiverTimes";

// The waiver order (#1198, spec/08 Waivers and free agency): who a run tries first. Its starting
// order is the reverse of the table, the bottom first, under reverse table order (the default), or
// the reverse of the draft order under rotating. Each team that wins a claim goes to the bottom, the
// latest winner last. Under rotating that never resets ("whoever last made a waiver is at the
// bottom, that doesnt reset"); under reverse table order it does once a gameweek ends ("the table
// order resets only fully only when a gameweek ends"). There is always a table, everyone on 0 at
// the start; teams level in it go by its own tie-breaks, then by the reverse of the draft order.
// A change of order type applies at once, from today's order (Craig, 6 Nov 2026, on #1200), so
// nobody jumps the queue by the switch: `switchWaiverOrder` keeps it as the order's start.

/** The league's waiver order row, or null before any run. */
export function waiverOrderRow(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"waiverOrders"> | null> {
  return ctx.db
    .query("waiverOrders")
    .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
    .unique();
}

/** The order the league's waivers start from since its last change of order type, or null if the
 *  type was never changed. */
function waiverStartRow(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"waiverStarts"> | null> {
  return ctx.db
    .query("waiverStarts")
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

/** The order a switch of type left, if it still stands with the latest gameweek begun `gameweek`:
 *  under rotating for good, under reverse table order until a later gameweek begins. Teams no longer
 *  in the league are passed over, and any not in it go last, in `teams`' order. Pure. */
export function startingFrom<Team>(
  order: LeagueRules["waivers"]["order"],
  start: { teams: readonly Team[]; gameweek: number | null } | null,
  gameweek: number | null,
  teams: readonly Team[],
): Team[] | null {
  if (start === null || (order === "reverseStandings" && start.gameweek !== gameweek)) return null;
  return [...start.teams.filter((team) => teams.includes(team)), ...teams.filter((team) => !start.teams.includes(team))];
}

/** The league's table, top first, teams level after its tie-breaks in the draft order: the table
 *  the waiver order reads. */
async function waiverTable(ctx: QueryCtx, league: Doc<"leagues">, season: SeasonRules, draftOrder: readonly Id<"teams">[]) {
  const { rules, schedule, scores } = await standingsOf(ctx, league, season);
  return tableOf(rules.format, draftOrder, schedule, scores, rules.tieBreaks);
}

const draftOrderIn = async (ctx: QueryCtx, league: Doc<"leagues">) => draftOrderOf(await teamsOf(ctx, league._id), league.draftOrder).map(({ _id }) => _id);

/** The league's waiver order at a run before any of its claims are tried, first first, given the
 *  winners that still count and the latest gameweek begun. */
export async function waiverOrderOf(
  ctx: QueryCtx,
  league: Doc<"leagues">,
  season: SeasonRules,
  winners: readonly Id<"teams">[],
  gameweek: number | null,
): Promise<Id<"teams">[]> {
  const order = season.latest.waivers.order;
  const draftOrder = await draftOrderIn(ctx, league);
  const start = startingFrom(order, await waiverStartRow(ctx, league._id), gameweek, draftOrder.toReversed());
  if (start !== null) return withWinnersLast(start, winners);
  if (order === "rotating") return withWinnersLast(draftOrder.toReversed(), winners);
  // Teams still level after the table's tie-breaks keep the order they come in: the draft order,
  // so reversed they go by its reverse.
  const table = await waiverTable(ctx, league, season, draftOrder);
  return withWinnersLast(table.map(({ team }) => team).toReversed(), winners);
}

/** The league's waiver order at `now`, first first, under the rules `season` holds. */
async function orderNow(ctx: QueryCtx, league: Doc<"leagues">, season: SeasonRules, gameweek: number | null): Promise<Id<"teams">[]> {
  const winners = winnersNow(season.latest.waivers.order, await waiverOrderRow(ctx, league._id), gameweek);
  return waiverOrderOf(ctx, league, season, winners, gameweek);
}

/** Keeps today's waiver order as the start of the order from now on: called as the commissioner
 *  changes the order type, before the new rules are saved, so `season` is the rules it had. The
 *  winners go into the start, so none count again. */
export async function switchWaiverOrder(ctx: MutationCtx, league: Doc<"leagues">, season: SeasonRules, now: number): Promise<void> {
  const gameweek = latestBegun(await leagueDeadlines(ctx, league._id), now);
  const teams = await orderNow(ctx, league, season, gameweek);
  const start = await waiverStartRow(ctx, league._id);
  if (start === null) await ctx.db.insert("waiverStarts", { leagueId: league._id, teams, gameweek });
  else await ctx.db.patch("waiverStarts", start._id, { teams, gameweek });
  const held = await waiverOrderRow(ctx, league._id);
  if (held !== null) await ctx.db.patch("waiverOrders", held._id, { winners: [], gameweek });
}

/** Whether the free agent window is open at `now`, the lock aside: no gameweek begun yet, or a
 *  waiver run made since the latest begun one's deadline (#1199). Made runs never fall in the lock,
 *  so one after the deadline came after the gameweek's last match. */
export async function windowOpen(ctx: QueryCtx, leagueId: Id<"leagues">, deadlines: LeagueDeadlines, now: number): Promise<boolean> {
  const gameweek = latestBegun(deadlines, now);
  if (gameweek === null) return true;
  const deadline = deadlines.get(gameweek) ?? null;
  const madeAt = (await waiverOrderRow(ctx, leagueId))?.madeAt;
  return deadline !== null && madeAt !== undefined && madeAt > deadline;
}

/** The next deadline after `now`, or null with none set. Pure. */
function nextDeadline(deadlines: LeagueDeadlines, now: number): { gameweek: number; at: number } | null {
  let next: { gameweek: number; at: number } | null = null;
  for (const [gameweek, at] of deadlines) if (at !== null && at > now && (next === null || at < next.at)) next = { gameweek, at };
  return next;
}

const waiversView = v.object({
  type: v.union(...WAIVER_ORDERS.map((each) => v.literal(each))),
  /** Every team, first in the order first, with its place and points in the table. */
  teams: v.array(v.object({ teamId: v.id("teams"), name: v.string(), tablePlace: v.number(), points: v.number() })),
  /** The next time each of the league's runs is made, soonest first, UK time as the rules set it. */
  runs: v.array(v.number()),
  /** Whether it is in the lock, from a deadline until the gameweek's last match is over. */
  locked: v.boolean(),
  /** Whether free agents can be picked up now, the lock aside. */
  windowOpen: v.boolean(),
  /** The next deadline, when the window shuts, or null with none set. */
  nextDeadline: v.union(v.object({ gameweek: v.number(), at: v.number() }), v.null()),
});
export type WaiversView = Infer<typeof waiversView>;

/** The league's waivers at `now`, for anyone in it (Craig, 6 Nov 2026, on #1200: "Everyone sees
 *  the whole order"): the waiver order with each team's table place, the next runs and the free
 *  agent window. Null for a league made before rules were held, which has no waivers. */
export const ofLeague = query({
  args: { leagueId: v.id("leagues"), now: v.number() },
  returns: v.union(waiversView, v.null()),
  handler: async (ctx, { leagueId, now }): Promise<WaiversView | null> => {
    const { league } = await memberOf(ctx, leagueId);
    const season = await seasonRules(ctx, leagueId);
    if (season === null) return null;
    const deadlines = await leagueDeadlines(ctx, leagueId);
    const order = await orderNow(ctx, league, season, latestBegun(deadlines, now));
    const table = await waiverTable(ctx, league, season, await draftOrderIn(ctx, league));
    const names = new Map((await teamsOf(ctx, leagueId)).map(({ _id, name }) => [_id, name]));
    const runs = season.latest.waivers.runs.flatMap((run) => firstRunFrom([run], now) ?? []).sort((one, other) => one - other);
    return {
      type: season.latest.waivers.order,
      teams: order.map((teamId) => {
        const place = table.findIndex(({ team }) => team === teamId);
        return { teamId, name: names.get(teamId)!, tablePlace: place + 1, points: table[place]?.points ?? 0 };
      }),
      runs,
      locked: await inWaiverLock(ctx, deadlines, now),
      windowOpen: await windowOpen(ctx, leagueId, deadlines, now),
      nextDeadline: nextDeadline(deadlines, now),
    };
  },
});
