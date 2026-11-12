import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { scoutsPerTeam } from "../admin/platformSettings";
import { scoutState } from "../schema";
import { takeAllOrThrow } from "../shared/cappedRead";
import { memberOf, playerOrRefuse, refuse } from "../shared/leagueAccess";
import { hasLeft, playerByCode, unheldPlayerWords } from "../shared/players";
import { DAY_MS, seasonStartAt } from "../shared/time";
import { ownTeam } from "./shortlist";
import { scoutRefusals } from "./scoutWords";

// Scouts (spec/19, Scouts; #375): each team has the site's number of them (3). A manager sends one
// to any player still in the Premier League, another team's included, and his report is ready 24
// hours on (scoutReports.ts writes it). A scout is free again once his report lands, with no other
// cap; he can't be called back, and only one is on a player at a time (Craig, 6 Nov 2026, on
// #375). Private to the team: only its manager reads its scouts, so no other team can tell whom it
// scouts.

/** How long a scout is out: his report is ready 24 hours after he is sent (spec/19). */
export const SCOUT_TRIP_MS = DAY_MS;

/** The most of a team's scouts out at once that one read takes: far above any site setting. Past
 *  it the read throws rather than undercount. */
const SCOUTS_OUT_READ_MOST = 50;

/** The most reports the team's list shows: its newest. */
const REPORTS_SHOWN = 50;

/** The most of the team's trips to one player his card shows, out or back: its newest. */
const PLAYER_TRIPS_SHOWN = 50;

/** A trip whose report is written. */
type ReportedTrip = Doc<"scouts"> & { report: NonNullable<Doc<"scouts">["report"]> };

/** Whether the trip's report is written: the report and the "reported" state are set together
 *  (scoutReports.ts). */
function isReported(row: Doc<"scouts">): row is ReportedTrip {
  return row.report !== undefined;
}

/** The most scouts' trips one team makes in a season that the stars read takes: about one a day
 *  for every scout. Past it the read throws rather than hide stars wrongly. */
const SEASON_SCOUTS_READ_MOST = 1200;

/** The team's scouts out now. */
function scoutsOut(ctx: QueryCtx, teamId: Id<"teams">): Promise<Doc<"scouts">[]> {
  return takeAllOrThrow(
    ctx.db.query("scouts").withIndex("by_teamId_and_state", (q) => q.eq("teamId", teamId).eq("state", "out")),
    SCOUTS_OUT_READ_MOST,
    `Team ${teamId} has more than ${SCOUTS_OUT_READ_MOST} scouts out`,
  );
}

/** The players the team's scouts have reported on this season, the season `now` falls in. */
export async function scoutedThisSeason(ctx: QueryCtx, teamId: Id<"teams">, now: number): Promise<Set<number>> {
  const rows = await takeAllOrThrow(
    ctx.db.query("scouts").withIndex("by_teamId_and_sentAt", (q) => q.eq("teamId", teamId).gte("sentAt", seasonStartAt(now))),
    SEASON_SCOUTS_READ_MOST,
    `Team ${teamId} has sent more than ${SEASON_SCOUTS_READ_MOST} scouts this season`,
  );
  return new Set(rows.filter(isReported).map((row) => row.playerCode));
}

const nameOf = async (ctx: QueryCtx, playerCode: number) => (await playerByCode(ctx, playerCode))?.name ?? unheldPlayerWords(playerCode);

/** Sends one of the caller's scouts to the player. Refused when every scout is out, when one is
 *  already on him, and for a player who has left the Premier League. */
export const send = mutation({
  args: { leagueId: v.id("leagues"), playerCode: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, playerCode }) => {
    const team = await ownTeam(ctx, leagueId);
    const player = await playerOrRefuse(ctx, playerCode);
    if (hasLeft(player)) refuse(scoutRefusals.playerGone(player.name));
    const out = await scoutsOut(ctx, team._id);
    if (out.some((scout) => scout.playerCode === playerCode)) refuse(scoutRefusals.alreadyOut(player.name));
    const scouts = await scoutsPerTeam(ctx);
    if (out.length >= scouts) refuse(scoutRefusals.allOut(scouts));
    const sentAt = Date.now();
    const dueAt = sentAt + SCOUT_TRIP_MS;
    const scoutId = await ctx.db.insert("scouts", { leagueId, teamId: team._id, playerCode, sentAt, dueAt, state: "out" });
    await ctx.scheduler.runAt(dueAt, internal.scouting.scoutReports.write, { scoutId });
    return null;
  },
});

const outScout = v.object({ playerCode: v.number(), name: v.string(), sentAt: v.number(), dueAt: v.number() });
const report = v.object({ playerCode: v.number(), name: v.string(), sentAt: v.number(), writtenAt: v.number(), text: v.string() });
const trip = v.object({
  playerCode: v.number(),
  sentAt: v.number(),
  dueAt: v.number(),
  state: scoutState,
  report: v.union(v.object({ text: v.string(), writtenAt: v.number() }), v.null()),
});
const myScouts = v.object({ scouts: v.number(), out: v.array(outScout), reports: v.array(report) });

/** The team's scouts, as `mine` reads them. */
export type MyScouts = Infer<typeof myScouts>;
/** One scout's trip to a player, as `onPlayer` reads it. */
export type ScoutTrip = Infer<typeof trip>;

/** The caller's scouts (the Scouts panel's): how many the team has, those out (whom, and when each
 *  is back), and its newest REPORTS_SHOWN reports, newest first. Null for someone in the league who
 *  runs no team. */
export const mine = query({
  args: { leagueId: v.id("leagues") },
  returns: v.union(myScouts, v.null()),
  handler: async (ctx, { leagueId }) => {
    const { team } = await memberOf(ctx, leagueId);
    if (!team) return null;
    const out = (await scoutsOut(ctx, team._id)).toSorted((one, other) => one.dueAt - other.dueAt);
    const reported: ReportedTrip[] = [];
    const newest = ctx.db.query("scouts").withIndex("by_teamId_and_sentAt", (q) => q.eq("teamId", team._id)).order("desc");
    for await (const row of newest) {
      if (!isReported(row)) continue;
      reported.push(row);
      if (reported.length === REPORTS_SHOWN) break;
    }
    return {
      scouts: await scoutsPerTeam(ctx),
      out: await Promise.all(
        out.map(async ({ playerCode, sentAt, dueAt }) => ({ playerCode, name: await nameOf(ctx, playerCode), sentAt, dueAt })),
      ),
      reports: (
        await Promise.all(
          reported.map(async ({ playerCode, sentAt, report }) => ({ playerCode, name: await nameOf(ctx, playerCode), sentAt, ...report })),
        )
      ).toSorted((one, other) => other.writtenAt - one.writtenAt),
    };
  },
});

/** The caller's scouts' trips to one player (his card's), newest first: one out on him now, and each
 *  report on him, dated. Null for someone in the league who runs no team. */
export const onPlayer = query({
  args: { leagueId: v.id("leagues"), playerCode: v.number() },
  returns: v.union(v.array(trip), v.null()),
  handler: async (ctx, { leagueId, playerCode }) => {
    const { team } = await memberOf(ctx, leagueId);
    if (!team) return null;
    const rows = await ctx.db
      .query("scouts")
      .withIndex("by_teamId_and_playerCode_and_sentAt", (q) => q.eq("teamId", team._id).eq("playerCode", playerCode))
      .order("desc")
      .take(PLAYER_TRIPS_SHOWN);
    return rows.map(({ playerCode, sentAt, dueAt, state, report }) => ({ playerCode, sentAt, dueAt, state, report: report ?? null }));
  },
});
