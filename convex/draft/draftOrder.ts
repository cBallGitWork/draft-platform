import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { refuse, runnerOf, teamsOf } from "../shared/leagueAccess";

// The commissioner's draft order (spec/04, Starting it; #1087), used when the league's draft rules
// say the commissioner sets it. It starts as the order the teams joined in, and he can reorder it
// any time; a team that joins after he has goes straight to the bottom (Craig, 4 Nov 2026, on
// #1087). The league row holds his order (`draftOrder`); a team it doesn't name, as one that joined
// since, follows the named in the order they joined, so a team joining needs no write here.

/** Why a new order is refused, in the words the commissioner is shown. */
export const draftOrderRefusals = {
  teamsChanged: "The league's teams changed after you opened the draft order, so it wasn't saved. Check the order and move the team again.",
};

/** The league's teams in the commissioner's order: those `saved` names, in its order, then the
 *  rest in the order they joined (`teams` comes in that order). An id of a team no longer in the
 *  league is passed over. Pure. */
export function draftOrderOf<Team extends { _id: Id<"teams"> }>(teams: readonly Team[], saved: readonly Id<"teams">[] | undefined): Team[] {
  const byId = new Map(teams.map((team) => [team._id, team]));
  const named = (saved ?? []).flatMap((teamId) => byId.get(teamId) ?? []);
  const placed = new Set(named.map((team) => team._id));
  return [...named, ...teams.filter((team) => !placed.has(team._id))];
}

const orderOf = (teams: Doc<"teams">[], league: Doc<"leagues">) =>
  draftOrderOf(teams, league.draftOrder).map(({ _id, name }) => ({ teamId: _id, name }));

/** The commissioner's order as League settings shows it, first pick first. For whoever runs the
 *  league. */
export const teamOrder = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(v.object({ teamId: v.id("teams"), name: v.string() })),
  handler: async (ctx, { leagueId }) => {
    const { league } = await runnerOf(ctx, leagueId);
    return orderOf(await teamsOf(ctx, leagueId), league);
  },
});

/** Saves `teamIds` as the commissioner's order, first pick first. Refused unless they are the
 *  league's teams, each once: a team joined since the screen read them, or the order is wrong. */
export const setTeamOrder = mutation({
  args: { leagueId: v.id("leagues"), teamIds: v.array(v.id("teams")) },
  returns: v.null(),
  handler: async (ctx, { leagueId, teamIds }) => {
    const { league } = await runnerOf(ctx, leagueId);
    const teams = await teamsOf(ctx, leagueId);
    const given = new Set(teamIds);
    if (given.size !== teamIds.length || teamIds.length !== teams.length || teams.some((team) => !given.has(team._id))) {
      refuse(draftOrderRefusals.teamsChanged);
    }
    await ctx.db.patch("leagues", league._id, { draftOrder: teamIds });
    return null;
  },
});
