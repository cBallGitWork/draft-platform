import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx } from "../_generated/server";
import { refuse, runnerOf, teamsOf } from "../shared/leagueAccess";
import { shuffle } from "../table/roundRobin";
import { draftHasStarted } from "./draftRow";

// The draft order (spec/04, Starting it; #1087, #1089). It starts as the order the teams joined
// in; the commissioner reorders it himself, which covers an order drawn offline, or draws it at
// random from the teams there then, as often as he likes until the draft starts. A team that joins
// after goes straight to the bottom, and nothing redraws it on its own (Craig, 4 Nov 2026, on #1087
// and #1089). The league row holds the order (`draftOrder`); a team it doesn't name, as one that
// joined since, follows the named in the order they joined, so a team joining needs no write here.
// If he never sets it, the draft runs in the order the teams joined.

/** Why a new order is refused, in the words the commissioner is shown. */
export const draftOrderRefusals = {
  teamsChanged: "The league's teams changed after you opened the draft order, so it wasn't saved. Check the order and move the team again.",
  started: "The draft has started, so its order can't change.",
};

/** A team in the draft order. */
export const teamInOrder = v.object({ teamId: v.id("teams"), name: v.string() });

/** The league's teams in the draft order: those `saved` names, in its order, then the rest in the
 *  order they joined (`teams` comes in that order). An id of a team no longer in the league is
 *  passed over. Pure. */
export function draftOrderOf<Team extends { _id: Id<"teams"> }>(teams: readonly Team[], saved: readonly Id<"teams">[] | undefined): Team[] {
  const byId = new Map(teams.map((team) => [team._id, team]));
  const named = (saved ?? []).flatMap((teamId) => byId.get(teamId) ?? []);
  const placed = new Set(named.map((team) => team._id));
  return [...named, ...teams.filter((team) => !placed.has(team._id))];
}

/** The league's draft order, first pick first, each team with its name. */
export const teamOrderOf = (teams: Doc<"teams">[], league: Doc<"leagues">) =>
  draftOrderOf(teams, league.draftOrder).map(({ _id, name }) => ({ teamId: _id, name }));

/** The draft order as League settings shows it, first pick first, and whether the draft has
 *  started, which fixes it. For whoever runs the league. */
export const teamOrder = query({
  args: { leagueId: v.id("leagues") },
  returns: v.object({ teams: v.array(teamInOrder), started: v.boolean() }),
  handler: async (ctx, { leagueId }) => {
    const { league } = await runnerOf(ctx, leagueId);
    return { teams: teamOrderOf(await teamsOf(ctx, leagueId), league), started: await draftHasStarted(ctx, leagueId) };
  },
});

/** The league, its teams and whoever runs it, if the draft order may still change; otherwise a
 *  refusal. */
async function orderChanger(ctx: MutationCtx, leagueId: Id<"leagues">) {
  const { league } = await runnerOf(ctx, leagueId);
  if (await draftHasStarted(ctx, leagueId)) refuse(draftOrderRefusals.started);
  return { league, teams: await teamsOf(ctx, leagueId) };
}

/** Saves `teamIds` as the draft order, first pick first. Refused once the draft has started, and
 *  unless they are the league's teams, each once: a team joined since the screen read them, or the
 *  order is wrong. */
export const setTeamOrder = mutation({
  args: { leagueId: v.id("leagues"), teamIds: v.array(v.id("teams")) },
  returns: v.null(),
  handler: async (ctx, { leagueId, teamIds }) => {
    const { league, teams } = await orderChanger(ctx, leagueId);
    const given = new Set(teamIds);
    if (given.size !== teamIds.length || teamIds.length !== teams.length || teams.some((team) => !given.has(team._id))) {
      refuse(draftOrderRefusals.teamsChanged);
    }
    await ctx.db.patch("leagues", league._id, { draftOrder: teamIds });
    return null;
  },
});

/** "Draw at random" (Craig, 4 Nov 2026, on #1089): saves the league's teams now in a random order
 *  as the draft order. Refused once the draft has started. */
export const drawTeamOrder = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const { league, teams } = await orderChanger(ctx, leagueId);
    await ctx.db.patch("leagues", league._id, { draftOrder: shuffle(teams.map((team) => team._id), Math.random) });
    return null;
  },
});
