import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { recordEvent } from "../mail/letters";
import { seasonRules } from "../rules/rulesHistory";
import { inTenths } from "../scoring/values";
import { refuse, runnerOf, teamIn } from "../shared/leagueAccess";
import { figureWords } from "../shared/numberWords";
import { typedText } from "../shared/typedText";
import { begunGameweeks, workedOutGameweek } from "../gameweekScorer/gameweekScores";
import { leagueReads } from "../gameweekScorer/teamGameweek";
import { rescoreGameweek } from "./finalScores";
import { OVERRIDE_REASON_MAX, TEAM_OVERRIDE_POINTS_MOST } from "./overrideLimits";
import { overrideRefusals } from "./pointsOverrides";

// A commissioner overrides one team's total in one gameweek, with a reason (spec/14 S14.3; #903):
// "set the total". The row stands as the team's points wherever the league's scorer reads them
// (gameweekScores.ts), so the head-to-head and the table follow it, over the gameweek's player
// overrides and any later correction until it is changed or removed (S14.4, S14.5). Any gameweek
// the league has begun, open or final (S14.2). Setting or removing one re-scores the gameweek's
// stored scores (finalScores.ts) and files a letter to the whole league (spec/15).

/** Why a team's override was refused, beyond a player's (`overrideRefusals`). */
export const teamOverrideRefusals = {
  outOfRange: `A team's override is from ${figureWords(-TEAM_OVERRIDE_POINTS_MOST)} to ${TEAM_OVERRIDE_POINTS_MOST} points.`,
  noOverride: (teamName: string, gameweek: number) => `${teamName}'s total in gameweek ${gameweek} isn't overridden.`,
} as const;

/** The league's commissioner, co-commissioner or the admin sets the team's total in the gameweek. */
export const overrideTeam = mutation({
  args: { leagueId: v.id("leagues"), gameweek: v.number(), teamId: v.id("teams"), points: v.number(), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { leagueId, gameweek, teamId, points, reason: typed }) => {
    const scored = await overridableTeam(ctx, leagueId, gameweek, teamId);
    const reason = typedText(typed, OVERRIDE_REASON_MAX, { blank: overrideRefusals.blankReason, tooLong: overrideRefusals.reasonTooLong });
    if (!Number.isFinite(points) || inTenths(points) !== points) refuse(overrideRefusals.notPoints);
    if (Math.abs(points) > TEAM_OVERRIDE_POINTS_MOST) refuse(teamOverrideRefusals.outOfRange);
    if (scored.wholePointsOnly && !Number.isInteger(points)) refuse(overrideRefusals.notWhole);

    const held = await heldTeamOverride(ctx, leagueId, gameweek, teamId);
    const row = { leagueId, gameweek, teamId, points, reason, by: scored.by, at: Date.now() };
    const { from, to } = await rescored(ctx, scored, async () => {
      if (held === null) await ctx.db.insert("teamOverrides", row);
      else await ctx.db.replace("teamOverrides", held._id, row);
    });
    await recordEvent(ctx, leagueId, scored.by, { kind: "teamPointsOverridden", teamId, teamName: scored.team.name, gameweek, from, to, reason });
    return null;
  },
});

/** The same three take a team's override away, and its total is scored again. */
export const removeTeamOverride = mutation({
  args: { leagueId: v.id("leagues"), gameweek: v.number(), teamId: v.id("teams") },
  returns: v.null(),
  handler: async (ctx, { leagueId, gameweek, teamId }) => {
    const scored = await overridableTeam(ctx, leagueId, gameweek, teamId);
    const held = (await heldTeamOverride(ctx, leagueId, gameweek, teamId)) ?? refuse(teamOverrideRefusals.noOverride(scored.team.name, gameweek));
    const { from, to } = await rescored(ctx, scored, () => ctx.db.delete("teamOverrides", held._id));
    await recordEvent(ctx, leagueId, scored.by, { kind: "teamPointsOverridden", teamId, teamName: scored.team.name, gameweek, from, to, reason: null });
    return null;
  },
});

/** One team's gameweek, as an override of its total reads it. */
interface OverriddenTeam {
  by: string;
  league: Doc<"leagues">;
  team: Doc<"teams">;
  gameweek: number;
  /** Whether the site's set in force then counts whole points only. */
  wholePointsOnly: boolean;
  /** The team's total as the scorer works it out now, any saved total set aside. */
  total: () => Promise<number>;
}

/** The caller, if they run the league, and the team's gameweek, refused with the reason where it
 *  can't be overridden. */
async function overridableTeam(ctx: MutationCtx, leagueId: Id<"leagues">, gameweek: number, teamId: Id<"teams">): Promise<OverriddenTeam> {
  const { email: by, league } = await runnerOf(ctx, leagueId);
  const team = await teamIn(ctx, leagueId, teamId);
  const season = (await seasonRules(ctx, leagueId)) ?? refuse(overrideRefusals.noRules);
  if (!(await begunGameweeks(ctx, league)).includes(gameweek)) refuse(overrideRefusals.notBegun(gameweek));
  const reads = await leagueReads(ctx, league, season);
  const total = async () => (await (await workedOutGameweek(ctx, reads, gameweek, [teamId])).pointsOf(teamId)).points;
  return { by, league, team, gameweek, wholePointsOnly: reads.setIn(gameweek).wholePointsOnly, total };
}

function heldTeamOverride(ctx: MutationCtx, leagueId: Id<"leagues">, gameweek: number, teamId: Id<"teams">) {
  return ctx.db
    .query("teamOverrides")
    .withIndex("by_leagueId_and_gameweek_and_teamId", (q) => q.eq("leagueId", leagueId).eq("gameweek", gameweek).eq("teamId", teamId))
    .unique();
}

/** The team's total before and after `change`, which then re-scores the gameweek's stored scores. */
async function rescored(ctx: MutationCtx, scored: OverriddenTeam, change: () => Promise<unknown>) {
  const from = await scored.total();
  await change();
  const to = await scored.total();
  await rescoreGameweek(ctx, scored.league, scored.gameweek);
  return { from, to };
}
