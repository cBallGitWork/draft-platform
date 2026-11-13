import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { seasonRules } from "../rules/rulesHistory";
import { scheduleEveryLeague } from "../shared/cappedRead";
import { teamsOf } from "../shared/leagueAccess";
import { leagueScores } from "../gameweekScorer/gameweekScores";
import { startRecap } from "../home/recaps";

// Stores each team's points in a gameweek once they are final (#418), so the table reads them
// rather than scoring the whole season on every read. Final means every match in the gameweek has
// locked: after the lock "a correction doesn't change points" (spec/07). A match moved into or out
// of it later reopens it (gameweekScores.ts says how). The lock of a gameweek's last match
// (matchStats.ts, #1547) asks every league to store what is newly final, in its own transaction, so a league that can't be scored
// never holds up a lock or another league.
//
// A stored score can still go stale if the code that scores changes (a bug fixed in scoring, say),
// or a commissioner overrides a player's points for a match (spec/14, #32). A player's positions or
// club changed after the deadline never reach it: auto-subs read him as he stood then
// (deadlineStars.ts, #1540), save in a gameweek kept before that, which reads him as he is now.
// `rescore` is that path: it drops a gameweek's stored scores and stores them again from the
// records; an override calls `rescoreGameweek` itself, in its own transaction.

/** Asks every league to store its newly final gameweeks, each in its own transaction. */
export const storeEveryLeague = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await scheduleEveryLeague(ctx, internal.table.finalScores.storeLeague, "so some would have their final scores unstored");
    return null;
  },
});

/** Stores each gameweek of the league that is final and not yet stored for every team. Returns
 *  the gameweeks it stored. */
export const storeLeague = internalMutation({
  args: { leagueId: v.id("leagues") },
  returns: v.array(v.number()),
  handler: async (ctx, { leagueId }) => {
    const league = await ctx.db.get("leagues", leagueId);
    if (league === null) return [];
    return await storeFinal(ctx, league);
  },
});

/** Drops the league's stored scores for the gameweek and stores them again from the records, if it
 *  is still final. Returns whether it stored them. */
export const rescore = internalMutation({
  args: { leagueId: v.id("leagues"), gameweek: v.number() },
  returns: v.boolean(),
  handler: async (ctx, { leagueId, gameweek }) => {
    const league = await ctx.db.get("leagues", leagueId);
    if (league === null) throw new Error(`No league ${leagueId} to rescore`);
    return await rescoreGameweek(ctx, league, gameweek);
  },
});

/** `rescore`'s work, for a mutation that changes what a gameweek scores. */
export async function rescoreGameweek(ctx: MutationCtx, league: Doc<"leagues">, gameweek: number): Promise<boolean> {
  await dropGameweek(ctx, league._id, gameweek);
  return (await storeFinal(ctx, league)).includes(gameweek);
}

/** Scores the league as the table does, and stores each team's points worked out that are final:
 *  the whole gameweek afresh when its matches have changed since it was stored, else only the
 *  teams added since, leaving the rest as stored. */
async function storeFinal(ctx: MutationCtx, league: Doc<"leagues">): Promise<number[]> {
  const season = await seasonRules(ctx, league._id);
  const teamIds = (await teamsOf(ctx, league._id)).map((team) => team._id);
  const { scores, finalUnstored } = await leagueScores(ctx, league, season, teamIds);
  const storedAt = Date.now();
  for (const { gameweek, teamIds: worked, fixtureCodes, replace } of finalUnstored) {
    if (replace) await dropGameweek(ctx, league._id, gameweek);
    for (const teamId of worked) {
      const { points } = scores.get(gameweek)!.get(teamId)!;
      await ctx.db.insert("finalScores", { leagueId: league._id, gameweek, teamId, points, fixtureCodes, storedAt });
    }
  }
  const stored = finalUnstored.map(({ gameweek }) => gameweek);
  // Every match of it final: the league's newest final gameweek gets its recap, once (home/recaps.ts).
  // Only the newest, so a pass catching up on several, or storing an older one again, writes and
  // Mails no recap League home would never show.
  const newest = await ctx.db
    .query("finalScores")
    .withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", league._id))
    .order("desc")
    .first();
  if (newest !== null && stored.includes(newest.gameweek)) await startRecap(ctx, league._id, newest.gameweek);
  return stored;
}

/** The gameweek's stored rows go: a team's left from before it was removed among them. */
async function dropGameweek(ctx: MutationCtx, leagueId: Id<"leagues">, gameweek: number): Promise<void> {
  const rows = ctx.db
    .query("finalScores")
    .withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", leagueId).eq("gameweek", gameweek));
  for await (const row of rows) await ctx.db.delete("finalScores", row._id);
}
