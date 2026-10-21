import { v, type Infer } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isLocked } from "./deadline";
import { recordEvent, refuse, runnerOf } from "./leagueAccess";
import { fplDeadline, fplDeadlines, isGameweek, isGameweekUsed, noSuchGameweek, SEASON_GAMEWEEKS, unusedAfter } from "./usedGameweeks";

// The commissioner ticks the gameweeks the league plays, all 38 by default (#74; spec/13,
// Gameweeks). A gameweek has begun once FPL's deadline for it (#21's gameweeks) has passed, and
// from then on it can't be ticked or unticked; before gameweek 1 begins, every one can be.
// Each league's deadline rule is stored (#120, leagueRules.ts), but nothing reads it here yet:
// FPL's deadline decides when a gameweek has begun.

/** Why a change to the league's gameweeks was refused, as the commissioner is told it. */
export const gameweekRefusals = {
  notAGameweek: noSuchGameweek,
  begun: (gameweek: number) => `Gameweek ${gameweek} has begun, so it can't be ticked or unticked.`,
  noDeadline: (gameweek: number) =>
    `The app doesn't have FPL's deadline for gameweek ${gameweek} yet, so it can't tell whether it has begun. Try again once FPL's gameweeks have arrived.`,
} as const;

export const leagueGameweek = v.object({
  gameweek: v.number(),
  used: v.boolean(),
  deadline: fplDeadline,
});
export type LeagueGameweek = Infer<typeof leagueGameweek>;

/** The league's gameweeks, 1 to 38, for its commissioner's screen. Whether one has begun is for
 *  the screen to work out from its deadline: a query doesn't read the clock. */
export const ofLeague = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(leagueGameweek),
  handler: async (ctx, { leagueId }) => {
    const { league } = await runnerOf(ctx, leagueId);
    const deadlines = await fplDeadlines(ctx);
    return SEASON_GAMEWEEKS.map((gameweek) => ({
      gameweek,
      used: isGameweekUsed(league, gameweek),
      deadline: deadlines.get(gameweek) ?? null,
    }));
  },
});

/** Ticks (`used`) or unticks one of the league's gameweeks, while it hasn't begun. */
export const setUsed = mutation({
  args: { leagueId: v.id("leagues"), gameweek: v.number(), used: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { leagueId, gameweek, used }) => {
    const { email, league } = await runnerOf(ctx, leagueId);
    if (!isGameweek(gameweek)) refuse(gameweekRefusals.notAGameweek(gameweek));
    const row = await ctx.db
      .query("gameweeks")
      .withIndex("by_number", (q) => q.eq("number", gameweek))
      .unique();
    if (row === null) refuse(gameweekRefusals.noDeadline(gameweek));
    if (isLocked(row.deadline, Date.now())) refuse(gameweekRefusals.begun(gameweek));
    if (isGameweekUsed(league, gameweek) === used) return null;
    await ctx.db.patch("leagues", leagueId, { unusedGameweeks: unusedAfter(league, gameweek, used) });
    await recordEvent(ctx, leagueId, email, { kind: "gameweekUsed", gameweek, used });
    return null;
  },
});
