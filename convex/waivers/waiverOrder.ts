import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { draftOrderOf } from "../draft/draftOrder";
import { draftIsOver } from "../draft/draftRow";
import { latestBegun, type LeagueDeadlines } from "../gameweeks/deadline";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { WAIVER_ORDERS, type LeagueRules } from "../rules/leagueRulesShape";
import { seasonRules, type SeasonRules } from "../rules/rulesHistory";
import { memberOf, teamsOf } from "../shared/leagueAccess";
import { standingsOf } from "../table/leagueTable";
import { tableOf } from "../table/sentTables";
import type { TableRow } from "../table/standings";
import { endedInHour, heldWaiverClock, windowOpenAt, type RunAhead } from "./runsAhead";
import { waiverClockOf } from "./waiverClock";

// The waiver order (#1198, spec/08 Waivers and free agency): who a run tries first. Its starting
// order is the reverse of the table, the bottom first, under reverse table order (the default), or
// the reverse of the draft order under rotating. Each team that wins a claim goes to the bottom, the
// latest winner last. Under rotating that never resets ("whoever last made a waiver is at the
// bottom, that doesnt reset"); under reverse table order it does once a gameweek ends ("the table
// order resets only fully only when a gameweek ends"), so from a deadline until that gameweek's
// last match is over the winners stay and the table behind the order is the one the last gameweek
// ended on (#1480). There is always a table, everyone on 0 at the start; teams level in it go by
// its own tie-breaks, then by the reverse of the draft order.
// A change of order type counts from the next deadline, as every rule change does (S03.11; Craig,
// 19 Nov 2026, on #2706: "Both wait for the next gameweek"), and from the order as it stood then
// (Craig, 6 Nov 2026, on #1200), so nobody jumps the queue by the switch: `orderStateAt` keeps it
// as the order's start.

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

/** Which winners still count, with the latest gameweek ended now (waiverLock.ts `latestEnded`):
 *  under reverse table order, none once a gameweek has ended since they were written. Pure. */
export function winnersNow<Team>(
  order: LeagueRules["waivers"]["order"],
  held: { winners: readonly Team[]; gameweek: number | null } | null,
  gameweek: number | null,
): Team[] {
  if (held === null) return [];
  return order === "reverseStandings" && held.gameweek !== gameweek ? [] : [...held.winners];
}

/** The order a switch of type left, if it still stands with the latest gameweek ended `gameweek`:
 *  under rotating for good, under reverse table order until a later gameweek ends. Teams no longer
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

type WaiverTable = TableRow<Id<"teams">>[];
type OrderType = LeagueRules["waivers"]["order"];
type OrderStart = { teams: readonly Id<"teams">[]; gameweek: number | null };
type HeldWinners = { winners: readonly Id<"teams">[]; gameweek: number | null };

/** The league's waiver order as it stands at a moment, before the latest gameweek ended is read:
 *  the order type in force, the start a switch of type left and the winners that may still count.
 *  `switched` says a switch since the last run, made or skipped, worked `start` out afresh. */
type OrderState = { type: OrderType; start: OrderStart | null; held: HeldWinners | null; switched: boolean };

/** Each gameweek whose deadline passed after `since` (any, if null) and by `until` with a different
 *  order type in force from the gameweek begun before it, oldest first: the type before it, and the
 *  latest gameweek ended at that deadline, the one begun before it, as the new one is under way.
 *  Pure. */
function typeSwitches(season: SeasonRules, deadlines: LeagueDeadlines, since: number | null, until: number): { before: OrderType; ended: number | null }[] {
  const typeSince = (begun: number | null) => season.sinceBegun(begun).waivers.order;
  const begun = [...deadlines]
    .filter((entry): entry is [number, number] => entry[1] !== null && entry[1] <= until)
    .sort(([one], [other]) => one - other);
  return begun.flatMap(([gameweek, at], index) => {
    const ended = index === 0 ? null : begun[index - 1][0];
    const before = typeSince(ended);
    return (since === null || at > since) && before !== typeSince(gameweek) ? [{ before, ended }] : [];
  });
}

/** The league's table as the gameweek `ended` ended, top first, teams level after its tie-breaks
 *  in the draft order: the table the waiver order reads. A gameweek still under way counts for
 *  nothing in it, and before any has ended everyone is on 0. */
async function waiverTable(
  ctx: QueryCtx,
  league: Doc<"leagues">,
  season: SeasonRules,
  draftOrder: readonly Id<"teams">[],
  ended: number | null,
): Promise<WaiverTable> {
  const { rules, schedule, scores, tieBreaks } = await standingsOf(ctx, league, season);
  const endedScores = new Map([...scores].filter(([gameweek]) => ended !== null && gameweek <= ended));
  return tableOf(rules.format, draftOrder, schedule, endedScores, tieBreaks);
}

const draftOrderIn = async (ctx: QueryCtx, league: Doc<"leagues">) => draftOrderOf(await teamsOf(ctx, league._id), league.draftOrder).map(({ _id }) => _id);

/** The league's waiver order under `type` at a run before any of its claims are tried, first first,
 *  given the start a switch of type left, the winners that still count and the latest gameweek
 *  ended. `table`, the league's `waiverTable`, is read here unless the caller already has it. */
export async function waiverOrderOf(
  ctx: QueryCtx,
  league: Doc<"leagues">,
  season: SeasonRules,
  type: OrderType,
  switchStart: OrderStart | null,
  winners: readonly Id<"teams">[],
  gameweek: number | null,
  table?: WaiverTable,
): Promise<Id<"teams">[]> {
  const draftOrder = await draftOrderIn(ctx, league);
  const start = startingFrom(type, switchStart, gameweek, draftOrder.toReversed());
  if (start !== null) return withWinnersLast(start, winners);
  if (type === "rotating") return withWinnersLast(draftOrder.toReversed(), winners);
  // Teams still level after the table's tie-breaks keep the order they come in: the draft order,
  // so reversed they go by its reverse.
  const standings = table ?? (await waiverTable(ctx, league, season, draftOrder, gameweek));
  return withWinnersLast(standings.map(({ team }) => team).toReversed(), winners);
}

/** The league's waiver order, first first, as `state` holds it, with the latest gameweek ended
 *  `gameweek`. */
function orderNow(ctx: QueryCtx, league: Doc<"leagues">, season: SeasonRules, state: OrderState, gameweek: number | null, table?: WaiverTable): Promise<Id<"teams">[]> {
  return waiverOrderOf(ctx, league, season, state.type, state.start, winnersNow(state.type, state.held, gameweek), gameweek, table);
}

/** The league's OrderState at `at`: the type in force for the latest gameweek begun (S03.11), with
 *  each switch of type whose deadline passed since the last run worked in turn. The order as it
 *  stood at that deadline, under the type before, becomes the start, and its winners go into it, so
 *  none count again. A run saves what it worked out (`orderStateKept`). */
async function orderStateAt(ctx: QueryCtx, league: Doc<"leagues">, season: SeasonRules, deadlines: LeagueDeadlines, at: number): Promise<OrderState> {
  const held = await waiverOrderRow(ctx, league._id);
  const type = season.sinceBegun(latestBegun(deadlines, at)).waivers.order;
  let state: OrderState = { type, start: await waiverStartRow(ctx, league._id), held, switched: false };
  for (const { before, ended } of typeSwitches(season, deadlines, held?.ranAt ?? null, at)) {
    const teams = await orderNow(ctx, league, season, { ...state, type: before }, ended);
    state = { type, start: { teams, gameweek: ended }, held: { winners: [], gameweek: ended }, switched: true };
  }
  return state;
}

/** The league's `orderStateAt` the run at `at`, the start a switch of type left saved as the
 *  league's: a run counts a change of type from the deadline it waited for, by its own time. */
export async function orderStateKept(ctx: MutationCtx, league: Doc<"leagues">, season: SeasonRules, deadlines: LeagueDeadlines, at: number): Promise<OrderState> {
  const state = await orderStateAt(ctx, league, season, deadlines, at);
  if (!state.switched || state.start === null) return state;
  const fields = { teams: [...state.start.teams], gameweek: state.start.gameweek };
  const start = await waiverStartRow(ctx, league._id);
  if (start === null) await ctx.db.insert("waiverStarts", { leagueId: league._id, ...fields });
  else await ctx.db.patch("waiverStarts", start._id, fields);
  return state;
}

/** Whether the free agent window is open at `now`, the lock aside (runsAhead.ts's `windowOpenAt`):
 *  the latest run's row is read only once a gameweek has begun. */
export async function windowOpen(ctx: QueryCtx, leagueId: Id<"leagues">, deadlines: LeagueDeadlines, now: number): Promise<boolean> {
  return latestBegun(deadlines, now) === null || windowOpenAt(deadlines, (await waiverOrderRow(ctx, leagueId))?.madeAt ?? null, now);
}

/** The deadline the free agent window has been shut since at `now`, or null while it is open:
 *  from it until the next made run, every player no team holds is on waivers (#1478). */
export async function windowShutSince(ctx: QueryCtx, leagueId: Id<"leagues">, deadlines: LeagueDeadlines, now: number): Promise<number | null> {
  if (await windowOpen(ctx, leagueId, deadlines, now)) return null;
  const gameweek = latestBegun(deadlines, now);
  return gameweek === null ? null : (deadlines.get(gameweek) ?? null);
}

const waiverOrderTeams = v.array(v.object({ teamId: v.id("teams"), name: v.string(), yours: v.boolean(), tablePlace: v.number(), points: v.number() }));

const heldWaivers = v.object({
  type: v.union(...WAIVER_ORDERS.map((each) => v.literal(each))),
  /** Every team, first in the order first, with its place and points in the table, for each latest
   *  gameweek ended that a minute of the hour can see (runsAhead.ts's `endedInHour`). */
  orders: v.array(v.object({ ended: v.union(v.number(), v.null()), teams: waiverOrderTeams })),
  /** Whether the league's draft is over: before it, claims, drops and pickups are refused (S08.1). */
  drafted: v.boolean(),
  /** When the latest waiver run was made, or null before any: the free agent window opens with it. */
  madeAt: v.union(v.number(), v.null()),
  /** The runs' times, the deadlines and which gameweeks are under way, for the hour (waiverClock.ts). */
  clock: heldWaiverClock,
  /** Whether a run is still failing after its retries, so managers see "Waivers delayed" (S08.23). */
  delayed: v.boolean(),
});
export type HeldWaivers = Infer<typeof heldWaivers>;

/** The league's waivers as Claims shows them at a minute (runsAhead.ts's `waiversAt`). */
export type WaiversView = Pick<HeldWaivers, "type" | "drafted" | "delayed"> & {
  /** Every team, first in the order first, with its place and points in the table. */
  teams: Infer<typeof waiverOrderTeams>;
  /** The next time each of the league's runs is made, soonest first, UK time as the rules set it,
   *  with the gameweek whose lock it may fall in, so may be skipped, or null when it surely won't. */
  runs: RunAhead[];
  /** Whether it is in the lock, from a deadline until the gameweek's last match is over. */
  locked: boolean;
  /** Whether free agents can be picked up now, the lock aside. */
  windowOpen: boolean;
  /** The deadline that shuts the window open now or next to open, or null with none set: the next
   *  deadline, unless the window is shut and its first run may fall in that deadline's gameweek's
   *  lock, when it is the deadline after (#1488). */
  windowShuts: { gameweek: number; at: number } | null;
  /** The gameweek whose end works the order out again: the one under way in the lock, else the next
   *  deadline's; null with neither. */
  resetsAfter: number | null;
};

/** The league's waivers for any minute of the hour starting at `hour`, for anyone in it (Craig,
 *  6 Nov 2026, on #1200: "Everyone sees the whole order"): the waiver order with each team's table
 *  place, and the times the next runs and the free agent window are judged by at the screen's
 *  minute (runsAhead.ts's `waiversAt`). It takes the hour, never the minute, so it isn't run again,
 *  uncached, every minute (#2008); it runs again when a run, a deadline, a score or the order
 *  changes, as before. */
export const ofLeague = query({
  args: { leagueId: v.id("leagues"), hour: v.number() },
  returns: heldWaivers,
  handler: async (ctx, { leagueId, hour }): Promise<HeldWaivers> => {
    const { league, team } = await memberOf(ctx, leagueId);
    const season = await seasonRules(ctx, leagueId);
    const deadlines = await leagueDeadlines(ctx, leagueId);
    // By the hour's start: a switch of type at a deadline in the hour shows from the next, in the
    // lock, when no claim can be made.
    const state = await orderStateAt(ctx, league, season, deadlines, hour);
    const clock = await waiverClockOf(ctx, leagueId, deadlines, hour);
    const names = new Map((await teamsOf(ctx, leagueId)).map(({ _id, name }) => [_id, name]));
    const draftOrder = await draftOrderIn(ctx, league);
    // Each table is read once: it orders the teams under reverse table order and gives each its
    // place and points, so the list reads in order.
    const orders = await Promise.all(
      endedInHour(deadlines, clock.underWay, hour).map(async (ended) => {
        const table = await waiverTable(ctx, league, season, draftOrder, ended);
        const order = await orderNow(ctx, league, season, state, ended, table);
        const teams = order.map((teamId) => {
          const place = table.findIndex(({ team }) => team === teamId);
          const name = names.get(teamId);
          if (place === -1 || name === undefined) throw new Error(`League ${leagueId}'s waiver order names team ${teamId}, which its ${place === -1 ? "table" : "teams"} doesn't hold`);
          return { teamId, name, yours: teamId === team?._id, tablePlace: place + 1, points: table[place].points };
        });
        return { ended, teams };
      }),
    );
    const held = await waiverOrderRow(ctx, leagueId);
    return {
      type: state.type,
      orders,
      drafted: await draftIsOver(ctx, leagueId),
      madeAt: held?.madeAt ?? null,
      clock,
      delayed: held?.delayedRun !== undefined,
    };
  },
});
