import { v, type Infer } from "convex/values";
import { query } from "../_generated/server";
import { positionsNow } from "../positions/playerPositions";
import { draftRulesOf } from "../rules/firstRules";
import { position } from "../schema/positions";
import { memberOf } from "../shared/leagueAccess";
import { clubsByCode, playerByCode } from "../shared/players";
import { draftIsLive, draftOf } from "./draftRow";
import { rulesInForceAt } from "./draftStart";

// The draft room's reads (spec/04, The draft room; #1098), beside the draft's own (draftStart.ts
// `ofLeague`): the picks made, for the board, and whether the room is in the menu. The room is in
// the menu from the moment the league is set up (Craig, 4 Nov 2026), and leaves it once the draft
// is over: "no the room goes off the meny, results can be somehwere else for record" (Craig, 4 Nov
// 2026, on #1098).

/** A pick on the board: its number, the team that made it, and the player it took, with his club's
 *  short name and his first position now; `player` is null for one the football data no longer
 *  holds (#323). */
const boardPick = v.object({
  pick: v.number(),
  teamId: v.id("teams"),
  player: v.union(v.object({ code: v.number(), name: v.string(), clubShortName: v.string(), position: v.union(position, v.null()) }), v.null()),
});
export type BoardPick = Infer<typeof boardPick>;

const draftBoard = v.object({
  picks: v.array(boardPick),
  /** The caller's team, null for a commissioner who runs none. */
  yourTeamId: v.union(v.id("teams"), v.null()),
  /** The league's pick time at `now`, in seconds: null for a league with no rules (before #25). */
  pickSeconds: v.union(v.number(), v.null()),
});
export type DraftBoard = Infer<typeof draftBoard>;

/** The board as everyone in the league reads it: every pick made, first first, the caller's team,
 *  and the league's pick time at `now`, the screen's minute, as a query must not read the clock. */
export const ofLeague = query({
  args: { leagueId: v.id("leagues"), now: v.number() },
  returns: draftBoard,
  handler: async (ctx, { leagueId, now }) => {
    const { team } = await memberOf(ctx, leagueId);
    const rows = await ctx.db
      .query("draftPicks")
      .withIndex("by_leagueId_and_pick", (q) => q.eq("leagueId", leagueId))
      .collect();
    const positionsOf = await positionsNow(ctx, leagueId);
    const clubs = clubsByCode(ctx);
    const picks = await Promise.all(
      rows.map(async ({ pick, teamId, playerCode }) => {
        const player = await playerByCode(ctx, playerCode);
        if (player === null) return { pick, teamId, player: null };
        const [club, positions] = await Promise.all([clubs(player.clubCode), positionsOf(player.code)]);
        return { pick, teamId, player: { code: player.code, name: player.name, clubShortName: club.shortName, position: positions[0] ?? null } };
      }),
    );
    const rules = await rulesInForceAt(ctx, leagueId, now);
    return { picks, yourTeamId: team?._id ?? null, pickSeconds: rules === null ? null : draftRulesOf(rules).pickSeconds };
  },
});

/** Whether the draft room is in the league's menu: until the draft is over, its last pick made. */
export const inMenu = query({
  args: { leagueId: v.id("leagues") },
  returns: v.boolean(),
  handler: async (ctx, { leagueId }) => {
    await memberOf(ctx, leagueId);
    return (await draftOf(ctx, leagueId))?.started === undefined || (await draftIsLive(ctx, leagueId));
  },
});
