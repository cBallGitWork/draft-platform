import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "../_generated/server";
import { everyLeague, takeShown } from "../shared/cappedRead";
import { fixtureByCode } from "../shared/fixtures";
import { adminOf, refuse } from "../shared/leagueAccess";
import { repriceMatches } from "../stats/seasonPointsMoves";
import { followKickoffs } from "../scoring/patchKickoffs";
import { recordPassedDeadlines } from "./deadlineRecorder";
import type { ScheduledMatch } from "./deadline";
import { leagueDeadlinesIn, scheduledMatches } from "./leagueDeadlines";
import { moveOf } from "./roundStarts";
import { seasonGameweekCount } from "./seasonGameweeks";
import { isGameweek, noSuchGameweek } from "./usedGameweeks";

// The admin moves a match to another gameweek (#1417; spec/07 S07.9: "The admin can move a
// match"; Craig, #1196 round 4 q1), held as an override the window rule (roundStarts.ts) yields to
// until he clears it. Any match, played or not (Craig, 10 Nov 2026: "Any match"): a played one's
// points move with it, since a gameweek's scores are worked out from the matches in it, and a final
// gameweek whose matches change is worked out and stored again (gameweekScorer/gameweekScores.ts).
// The deadline follows the gameweek's first kickoff as it stands (Craig, 12 Nov 2026, on #1417:
// "Deadline follows the match"), and a passed one stays where it fell (S05.25); the admin is
// warned when the move puts a deadline in the past or before the gameweek before ends. His moves
// are logged where only he sees them (spec/15). No screen yet: the admin dashboard has no approved
// picture, so he runs it from the CLI (docs/setup.md).

/** Why a move is refused, as the admin is told it. */
export const matchMoveRefusals = {
  noMatch: "There's no such match held.",
  dropped: "That match is no longer in the feed, so it can't be moved.",
} as const;

/** What the admin is told when a move shifts a deadline badly, naming the leagues it does so in. */
export const matchMoveWarnings = {
  past: (gameweek: number, leagues: readonly string[]) => `Gameweek ${gameweek}'s deadline is now already past in ${leagues.join(", ")}.`,
  beforeLastEnds: (gameweek: number, leagues: readonly string[]) =>
    `Gameweek ${gameweek}'s deadline now falls before gameweek ${gameweek - 1}'s last match kicks off, so before it ends, in ${leagues.join(", ")}.`,
};

/** The most log rows `log` shows, newest first. */
export const MATCH_MOVE_LOG_SHOWN = 100;

/** Moves the match to `gameweek` and keeps it there whatever the feed then says, or, with
 *  `gameweek` null, clears his move, so it goes back to the gameweek the window rule gives it:
 *  none for a postponed match the feed puts in no round.
 *  Returns any warnings about the deadline the match is now the first kickoff of. */
export const move = mutation({
  args: { fixtureCode: v.number(), gameweek: v.union(v.number(), v.null()) },
  returns: v.object({ warnings: v.array(v.string()) }),
  handler: async (ctx, { fixtureCode, gameweek }) => {
    await adminOf(ctx);
    const match = (await fixtureByCode(ctx, fixtureCode)) ?? refuse(matchMoveRefusals.noMatch);
    if (match.droppedAt !== undefined) refuse(matchMoveRefusals.dropped);
    if (gameweek !== null) {
      const count = await seasonGameweekCount(ctx);
      if (!isGameweek(gameweek, count)) refuse(noSuchGameweek(gameweek, count));
    }
    // Before any deadline moves, as the football sync does (deadlineRecorder.ts, #150).
    await recordPassedDeadlines(ctx);
    const now = Date.now();
    const held = await moveOf(ctx, fixtureCode);
    // Unmoved, the match sits where the last sync's window rule put it; moved, his move keeps that.
    const unmoved = held === null ? match.gameweek : held.unmoved;
    const to = gameweek ?? unmoved;
    const before = await scheduledMatches(ctx);
    if (held !== null) await ctx.db.delete("matchMoves", held._id);
    if (gameweek !== null) await ctx.db.insert("matchMoves", { fixtureCode, gameweek, unmoved, movedAt: now });
    await ctx.db.insert("matchMoveLog", { fixtureCode, from: match.gameweek, to: gameweek, at: now });
    if (to !== match.gameweek) {
      await ctx.db.patch("fixtures", match._id, { gameweek: to });
      await repriceMatches(ctx, [match]);
      // A waiting patch follows its gameweek's first kickoff (patchKickoffs.ts, #901).
      await followKickoffs(ctx, now);
    }
    return { warnings: to === null ? [] : await deadlineWarnings(ctx, to, before, now) };
  },
});

/** Every move and clear the admin has made, newest first: for his eyes only. */
export const log = query({
  args: {},
  returns: v.object({
    rows: v.array(v.object({ fixtureCode: v.number(), from: v.union(v.number(), v.null()), to: v.union(v.number(), v.null()), at: v.number() })),
    more: v.boolean(),
  }),
  handler: async (ctx) => {
    await adminOf(ctx);
    const { rows, more } = await takeShown(ctx.db.query("matchMoveLog").withIndex("by_at").order("desc"), MATCH_MOVE_LOG_SHOWN);
    return { rows: rows.map(({ fixtureCode, from, to, at }) => ({ fixtureCode, from, to, at })), more };
  },
});

/** The warnings for `gameweek`'s deadline in each league where the move changed it: now already
 *  past, or before the gameweek before's last kickoff. */
async function deadlineWarnings(ctx: MutationCtx, gameweek: number, before: readonly ScheduledMatch[], now: number): Promise<string[]> {
  const after = await scheduledMatches(ctx);
  // -Infinity when the gameweek before has no kickoffs (or for gameweek 1, which has none before
  // it): no deadline can fall before it ends, so only the "already past" warning applies.
  const lastKickoffBefore = Math.max(...after.flatMap((match) => (match.gameweek === gameweek - 1 && match.kickoff !== null ? [match.kickoff] : [])));
  const past: string[] = [];
  const early: string[] = [];
  for (const league of await everyLeague(ctx, "so a moved match's deadline warnings would leave some out")) {
    const was = (await leagueDeadlinesIn(ctx, league._id, before)).get(gameweek) ?? null;
    const is = (await leagueDeadlinesIn(ctx, league._id, after)).get(gameweek) ?? null;
    if (is === null || is === was) continue;
    if (is <= now) past.push(league.name);
    else if (is < lastKickoffBefore) early.push(league.name);
  }
  return [
    ...(past.length > 0 ? [matchMoveWarnings.past(gameweek, past)] : []),
    ...(early.length > 0 ? [matchMoveWarnings.beforeLastEnds(gameweek, early)] : []),
  ];
}
