import { v, type Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import { isLocked } from "./deadline";
import { refuse, runnerOf } from "../shared/leagueAccess";
import { recordEvent } from "../mail/letters";
import { leagueDeadlineOf } from "./leagueDeadlines";
import { startAfterUntick } from "./scoringStart";
import { seasonGameweekCount } from "./seasonGameweeks";
import {
  begunRefusal,
  isGameweek,
  isGameweekUsed,
  noKickoffRefusal,
  noSuchGameweek,
  seasonGameweeks,
  shownDeadline,
  unusedAfter,
} from "./usedGameweeks";

// The commissioner ticks the gameweeks the league plays, all its season's by default (#74; spec/13,
// Gameweeks). A gameweek has begun once the league's own deadline for it has passed, under the
// deadline rule in force in it (leagueDeadlines.ts's `leagueDeadlines`; #138), and from then on it
// can't be ticked or unticked; before gameweek 1 begins, every one can be. FPL's deadline plays no
// part (deadline.ts's `leagueDeadline` says why). Unticking the league's scoring start moves it to
// the next ticked gameweek (scoringStart.ts).

/** Why a change to the league's gameweeks was refused, as the commissioner is told it. */
export const gameweekRefusals = {
  notAGameweek: noSuchGameweek,
  begun: (gameweek: number) => begunRefusal(gameweek, "it can't be ticked or unticked"),
  noDeadline: (gameweek: number) => noKickoffRefusal(gameweek, "when its deadline falls or whether it has begun"),
} as const;

const leagueGameweek = v.object({
  gameweek: v.number(),
  used: v.boolean(),
  deadline: shownDeadline,
});
export type LeagueGameweek = Infer<typeof leagueGameweek>;

/** The league's gameweeks, however many its season has (#1618), for its commissioner's screen. Whether one has begun is for
 *  the screen to work out from its deadline: a query doesn't read the clock. */
export const ofLeague = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(leagueGameweek),
  handler: async (ctx, { leagueId }) => {
    const { league } = await runnerOf(ctx, leagueId);
    const deadlineIn = await leagueDeadlineOf(ctx, leagueId);
    const count = await seasonGameweekCount(ctx);
    return seasonGameweeks(count).map((gameweek) => ({
      gameweek,
      used: isGameweekUsed(league, gameweek, count),
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
    const count = await seasonGameweekCount(ctx);
    if (!isGameweek(gameweek, count)) refuse(gameweekRefusals.notAGameweek(gameweek, count));
    const deadline = (await leagueDeadlineOf(ctx, leagueId))(gameweek);
    if (deadline === null) refuse(gameweekRefusals.noDeadline(gameweek));
    if (isLocked(deadline, Date.now())) refuse(gameweekRefusals.begun(gameweek));
    if (isGameweekUsed(league, gameweek, count) === used) return null;
    const scoringStart = used ? league.scoringStart : startAfterUntick(league, gameweek, count);
    await ctx.db.patch("leagues", leagueId, { unusedGameweeks: unusedAfter(league, gameweek, used), scoringStart });
    const moved = scoringStart === league.scoringStart ? {} : { startMovedTo: scoringStart };
    await recordEvent(ctx, leagueId, email, { kind: "gameweekUsed", gameweek, used, ...moved });
    return null;
  },
});
