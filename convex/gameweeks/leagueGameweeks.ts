import { v, type Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import { isLocked } from "./deadline";
import { refuse, runnerOf } from "../shared/leagueAccess";
import { recordEvent } from "../mail/letters";
import { deadlineOf, leagueDeadlines } from "./leagueDeadlines";
import { startAfterUntick } from "./scoringStart";
import { isGameweek, isGameweekUsed, noSuchGameweek, SEASON_GAMEWEEKS, shownDeadline, unusedAfter } from "./usedGameweeks";

// The commissioner ticks the gameweeks the league plays, all 38 by default (#74; spec/13,
// Gameweeks). A gameweek has begun once the league's own deadline for it has passed, under the
// deadline rule in force in it (leagueDeadlines.ts's `leagueDeadlines`; #138), and from then on it
// can't be ticked or unticked; before gameweek 1 begins, every one can be. FPL's deadline plays no
// part (deadline.ts's `leagueDeadline` says why). Unticking the league's scoring start moves it to
// the next ticked gameweek (scoringStart.ts).

/** Why a change to the league's gameweeks was refused, as the commissioner is told it. */
export const gameweekRefusals = {
  notAGameweek: noSuchGameweek,
  begun: (gameweek: number) => `Gameweek ${gameweek} has begun, so it can't be ticked or unticked.`,
  noDeadline: (gameweek: number) =>
    `The app doesn't have a kickoff time for gameweek ${gameweek} yet, so it can't tell when its deadline falls or whether it has begun. Try again once the season's matches have arrived.`,
} as const;

const leagueGameweek = v.object({
  gameweek: v.number(),
  used: v.boolean(),
  deadline: shownDeadline,
});
export type LeagueGameweek = Infer<typeof leagueGameweek>;

/** The league's gameweeks, 1 to 38, for its commissioner's screen. Whether one has begun is for
 *  the screen to work out from its deadline: a query doesn't read the clock. */
export const ofLeague = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(leagueGameweek),
  handler: async (ctx, { leagueId }) => {
    const { league } = await runnerOf(ctx, leagueId);
    const deadlineIn = deadlineOf(await leagueDeadlines(ctx, leagueId));
    return SEASON_GAMEWEEKS.map((gameweek) => ({
      gameweek,
      used: isGameweekUsed(league, gameweek),
      deadline: deadlineIn(gameweek),
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
    const deadline = deadlineOf(await leagueDeadlines(ctx, leagueId))(gameweek);
    if (deadline === null) refuse(gameweekRefusals.noDeadline(gameweek));
    if (isLocked(deadline, Date.now())) refuse(gameweekRefusals.begun(gameweek));
    if (isGameweekUsed(league, gameweek) === used) return null;
    const scoringStart = used ? league.scoringStart : startAfterUntick(league, gameweek);
    await ctx.db.patch("leagues", leagueId, { unusedGameweeks: unusedAfter(league, gameweek, used), scoringStart });
    const moved = scoringStart === league.scoringStart ? {} : { startMovedTo: scoringStart };
    await recordEvent(ctx, leagueId, email, { kind: "gameweekUsed", gameweek, used, ...moved });
    return null;
  },
});
