import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { leagueOpens } from "../leagues/leagueOpens";
import { deadlineOf, leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { GAMEWEEKS } from "../gameweeks/usedGameweeks";
import { seasonRules } from "../rules/rulesHistory";
import { managerOf, signedInEmail, teamOf } from "../shared/leagueAccess";
import { nextOpenGameweek } from "./lineups";
import { LINEUP_DUE_BEFORE_DEADLINE_MS } from "./lineupLimits";

// Continue's lineup step (spec/12, The frame; #526): "From 24 hours before each gameweek's deadline
// until the deadline, Continue takes the manager to his Tactics tab", until "he has opened the
// Tactics tab that gameweek" (Craig, 1 Nov 2026). The gameweek is the one a save now is from
// (lineups.ts's `nextOpenGameweek`), as the Tactics tab's is. Opening it is kept on the team's row
// (`tacticsOpenedInGameweek`), so his other devices know too.

/** Whether Continue leads the caller to his Tactics tab in the league at `now` (the screen's minute:
 *  a query may not read the clock): his team's gameweek locks within LINEUP_DUE_BEFORE_DEADLINE_MS
 *  and he hasn't opened Tactics in it. False, never a refusal, for anyone it can't apply to: the top
 *  bar asks it on every page, and one with no team in the league has no lineup step. */
export const isDue = query({
  args: { leagueId: v.id("leagues"), now: v.number() },
  returns: v.boolean(),
  handler: async (ctx, { leagueId, now }) => {
    const email = await signedInEmail(ctx);
    const league = await ctx.db.get("leagues", leagueId);
    if (email === null || league === null || !leagueOpens(league)) return false;
    const team = await teamOf(ctx, leagueId, email);
    if (team === undefined) return false;
    const season = await seasonRules(ctx, leagueId);
    if (season === null) return false;
    const gameweek = await nextOpenGameweek(ctx, leagueId, season, now);
    if (gameweek > GAMEWEEKS || team.tacticsOpenedInGameweek === gameweek) return false;
    const deadline = deadlineOf(await leagueDeadlines(ctx, leagueId))(gameweek);
    return deadline !== null && now >= deadline - LINEUP_DUE_BEFORE_DEADLINE_MS && now < deadline;
  },
});

/** The caller opened his own team's Tactics tab showing `gameweek`: Continue stops leading him there
 *  for it. Kept only while it is still the gameweek a save now is from, so a tab opened seconds
 *  before a deadline never counts for the next; otherwise, as for a league with no rules or when it
 *  is already kept, nothing is written and nothing refused. Refused for anyone who runs no team in
 *  the league. */
export const openedTactics = mutation({
  args: { leagueId: v.id("leagues"), gameweek: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, gameweek }) => {
    const { team } = await managerOf(ctx, leagueId);
    const season = await seasonRules(ctx, leagueId);
    if (season === null || team.tacticsOpenedInGameweek === gameweek) return null;
    if ((await nextOpenGameweek(ctx, leagueId, season, Date.now())) !== gameweek) return null;
    await ctx.db.patch("teams", team._id, { tacticsOpenedInGameweek: gameweek });
    return null;
  },
});
