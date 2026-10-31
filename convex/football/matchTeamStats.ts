import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type ActionCtx, type QueryCtx } from "../_generated/server";
import type { SideMatchOutcome } from "../admin/sideRuns";
import { sideTeamStats } from "../schema";
import { logFailure } from "../shared/errors";
import { readPlTeamStats, type RawPlFixture } from "./premierLeague/premierLeague";
import { plTeamStats, type SideTeamStats } from "./premierLeague/plTeamStats";

// Each match's five team stats (#45; spec/10, The match page), read with its points by the live
// tick (#28) and once more by the match stats sync at full time, and stored one row a match. Each
// read replaces the held five, as Opta sends running totals; a read before kickoff, with none,
// leaves them. A failed read is logged and the held five stand, so it stops neither the match's
// points nor its commentary; the run that read it puts it on the team stats feed's row (#522).

/** One match's team stats read and stored, and how it went. Never throws. `listed` is the match in
 *  the Premier League's list for its gameweek, read this run, for its id. */
export async function syncTeamStats(ctx: ActionCtx, fixtureCode: number, listed: RawPlFixture | undefined): Promise<SideMatchOutcome> {
  try {
    if (listed === undefined) throw new Error(`the Premier League lists no match ${fixtureCode}`);
    const stats = plTeamStats(await readPlTeamStats(listed.id));
    if (stats !== null) await ctx.runMutation(internal.football.matchTeamStats.store, { fixtureCode, ...stats });
    return { fixtureCode, ok: true };
  } catch (error: unknown) {
    return { fixtureCode, ok: false, error: logFailure(`match ${fixtureCode}'s team stats failed`, error) };
  }
}

/** A match's held five; null before its first read with any. */
export function heldTeamStatsOf(ctx: QueryCtx, fixtureCode: number): Promise<Doc<"matchTeamStats"> | null> {
  return ctx.db
    .query("matchTeamStats")
    .withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", fixtureCode))
    .unique();
}

/** One read's five over the match's row. A read that changes nothing is not written, so a screen
 *  reading the row is not woken each minute. */
export const store = internalMutation({
  args: { fixtureCode: v.number(), home: sideTeamStats, away: sideTeamStats },
  returns: v.null(),
  handler: async (ctx, next) => {
    const held = await heldTeamStatsOf(ctx, next.fixtureCode);
    if (held === null) {
      await ctx.db.insert("matchTeamStats", next);
      return null;
    }
    if (sameSide(held.home, next.home) && sameSide(held.away, next.away)) return null;
    await ctx.db.patch("matchTeamStats", held._id, { home: next.home, away: next.away });
    return null;
  },
});

/** Field by field, as a stored document's keys need not come back in the order they were written. */
function sameSide(held: SideTeamStats, next: SideTeamStats): boolean {
  return (Object.keys(next) as (keyof SideTeamStats)[]).every((stat) => held[stat] === next[stat]);
}
