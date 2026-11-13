import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { seasonGameweekCount } from "../gameweeks/seasonGameweeks";
import { lastPlayedGameweek } from "../gameweeks/usedGameweeks";
import { managerOf, ownTeamOrNone } from "../shared/leagueAccess";
import { saveGameweekOf } from "../gameweeks/saveGameweek";
import { lineupDueTimes } from "./lineupDueAt";

// Continue's lineup step (spec/12, The frame; #526): "From 24 hours before each gameweek's deadline
// until the deadline, Continue takes the manager to his Tactics tab", until "he has opened the
// Tactics tab that gameweek" (Craig, 1 Nov 2026). The gameweek is the one a save now is from
// (saveGameweek.ts's `saveGameweekOf`), as the Tactics tab's is. Opening it is kept on the team's row
// (`tacticsOpenedInGameweek`), so his other devices know too.

/** What Continue's lineup step is judged on for the caller in the league: the league's deadlines,
 *  its last gameweek and the gameweek he last opened Tactics in. lineupDueAt.ts's `lineupDueAt`
 *  judges it at the screen's minute; this takes no time, so it runs again only when one of them
 *  changes, never each minute (#2005). Null, never a refusal, for anyone it can't apply to: the top
 *  bar asks it on every page, and one with no team in the league has no lineup step. */
export const isDue = query({
  args: { leagueId: v.id("leagues") },
  returns: v.union(v.null(), lineupDueTimes),
  handler: async (ctx, { leagueId }) => {
    const own = await ownTeamOrNone(ctx, leagueId);
    if (own === null) return null;
    const { league, team } = own;
    return {
      deadlines: [...(await leagueDeadlines(ctx, leagueId))].map(([gameweek, deadline]) => ({ gameweek, deadline })),
      lastGameweek: lastPlayedGameweek(league, await seasonGameweekCount(ctx)),
      openedIn: team.tacticsOpenedInGameweek ?? null,
    };
  },
});

/** The caller opened his own team's Tactics tab showing `gameweek`: Continue stops leading him there
 *  for it. Kept only while it is still the gameweek a save now is from, so a tab opened seconds
 *  before a deadline never counts for the next; otherwise, as for a league with no rules, once the
 *  season is over, or when it is already kept, nothing is written and nothing refused. Refused for
 *  anyone who runs no team in the league. */
export const openedTactics = mutation({
  args: { leagueId: v.id("leagues"), gameweek: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, gameweek }) => {
    const { league, team } = await managerOf(ctx, leagueId);
    if (gameweek > lastPlayedGameweek(league, await seasonGameweekCount(ctx)) || team.tacticsOpenedInGameweek === gameweek) return null;
    const next = await saveGameweekOf(ctx, leagueId, Date.now());
    if (next.kind !== "open" || next.gameweek !== gameweek) return null;
    await ctx.db.patch("teams", team._id, { tacticsOpenedInGameweek: gameweek });
    return null;
  },
});
