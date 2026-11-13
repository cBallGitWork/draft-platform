import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { everyLeague, LEAGUES_READ_MOST, takeAllOrThrow } from "../shared/cappedRead";

// When each league's waivers and trade offers are next worth a look (#1998): the waiver and trade
// crons run every 5 minutes, and once read every league and its season's deadlines each time,
// most of the Convex free plan's database I/O. Now each league keeps the moment of its next check
// on a small indexed row, and a cron reads only the rows due. A check sets its own next moment,
// never later than the earliest it could act (waiverRun.ts, tradeClose.ts), and whatever can bring
// that moment earlier wakes the league, so it is looked at on the cron's next pass, as before: a
// league made or unfrozen, its rules saved, its draft started, an offer made, and a kickoff the
// football sync moves (every league). Nothing a manager sees changes.

/** The two checks a league's row holds. */
export type LeagueCheck = "waivers" | "offers";
const FIELD = { waivers: "waiversAt", offers: "offersAt" } as const;
const BOTH: readonly LeagueCheck[] = ["waivers", "offers"];

/** A check's moment while nothing is to come until something wakes the league. */
export const NEVER_DUE = Number.MAX_SAFE_INTEGER;

const rowOf = (ctx: MutationCtx, leagueId: Id<"leagues">) =>
  ctx.db
    .query("leagueChecks")
    .withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId))
    .unique();

/** Has the cron look at the league's `checks` on its next pass. */
export async function checkSoon(ctx: MutationCtx, leagueId: Id<"leagues">, checks: readonly LeagueCheck[] = BOTH): Promise<void> {
  const now = Date.now();
  const row = await rowOf(ctx, leagueId);
  if (row === null) {
    await ctx.db.insert("leagueChecks", { leagueId, waiversAt: now, offersAt: now });
    return;
  }
  const soonest = (check: LeagueCheck) => (checks.includes(check) ? Math.min(row[FIELD[check]], now) : row[FIELD[check]]);
  const sooner = { waiversAt: soonest("waivers"), offersAt: soonest("offers") };
  if (sooner.waiversAt !== row.waiversAt || sooner.offersAt !== row.offersAt) await ctx.db.patch("leagueChecks", row._id, sooner);
}

/** Has the cron look at every league on its next pass: a kickoff moved can move any league's
 *  deadlines. */
export async function checkEveryLeagueSoon(ctx: MutationCtx): Promise<void> {
  for (const { _id } of await everyLeague(ctx, "so some would miss a moved deadline")) await checkSoon(ctx, _id);
}

/** Sets when the league's `check` is next looked at, as that check worked it out. */
export async function checkAgainAt(ctx: MutationCtx, leagueId: Id<"leagues">, check: LeagueCheck, at: number): Promise<void> {
  const row = await rowOf(ctx, leagueId);
  const moment = check === "waivers" ? { waiversAt: at } : { offersAt: at };
  if (row === null) await ctx.db.insert("leagueChecks", { leagueId, waiversAt: NEVER_DUE, offersAt: NEVER_DUE, ...moment });
  else if (row[FIELD[check]] !== at) await ctx.db.patch("leagueChecks", row._id, moment);
}

/** Drops the row of a league gone. */
export async function forgetChecks(ctx: MutationCtx, leagueId: Id<"leagues">): Promise<void> {
  const row = await rowOf(ctx, leagueId);
  if (row !== null) await ctx.db.delete("leagueChecks", row._id);
}

/** The leagues whose `check` is due at `now`, for its cron. The first pass after this release
 *  finds no rows at all, and wakes every league first. */
export async function leaguesDue(ctx: MutationCtx, check: LeagueCheck, now: number): Promise<Id<"leagues">[]> {
  if ((await ctx.db.query("leagueChecks").first()) === null) await checkEveryLeagueSoon(ctx);
  const rows = ctx.db.query("leagueChecks");
  const due = await takeAllOrThrow(
    check === "waivers" ? rows.withIndex("by_waiversAt", (q) => q.lte("waiversAt", now)) : rows.withIndex("by_offersAt", (q) => q.lte("offersAt", now)),
    LEAGUES_READ_MOST,
    `More than ${LEAGUES_READ_MOST} leagues are due a ${check} check at once, so some would wait`,
  );
  return due.map(({ leagueId }) => leagueId);
}
