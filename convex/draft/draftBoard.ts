import { v, type Infer } from "convex/values";
import { query } from "../_generated/server";
import { positionsNow } from "../positions/playerPositions";
import { draftRulesOf } from "../rules/firstRules";
import { latestRules } from "../rules/rulesHistory";
import { position } from "../schema";
import { memberOf } from "../shared/leagueAccess";
import { clubsByCode, playerByCode } from "../shared/players";
import { pickSecondsOf } from "./draftPickTime";
import { squadRulesOf } from "./draftPicks";
import { draftIsLive, draftOf } from "./draftRow";
import { isOnAutoPick } from "./draftTimeouts";

// The draft room's reads (spec/04, The draft room; #1098), beside the draft's own (draftStart.ts
// `ofLeague`): the picks made, for the board, and whether the room is in the menu. The room is in
// the menu from the moment the league is set up (Craig, 4 Nov 2026), and leaves it once the draft
// is over: "no the room goes off the meny, results can be somehwere else for record" (Craig, 4 Nov
// 2026, on #1098).

/** A pick on the board: its number, the team that made it, whether the draft made it (auto-pick,
 *  marked "auto" for the whole league; Craig, 5 Nov 2026, on #1100), and the player it took, with
 *  his club's short name and his first position now; `player` is null for one the football data no
 *  longer holds (#323). */
const boardPick = v.object({
  pick: v.number(),
  teamId: v.id("teams"),
  auto: v.boolean(),
  player: v.union(v.object({ code: v.number(), name: v.string(), clubShortName: v.string(), position: v.union(position, v.null()) }), v.null()),
});
export type BoardPick = Infer<typeof boardPick>;

const draftBoard = v.object({
  picks: v.array(boardPick),
  /** The caller's team, null for a commissioner who runs none. */
  yourTeamId: v.union(v.id("teams"), v.null()),
  /** The draft's pick time, in seconds: its own once it has started, else the league's latest; null
   *  for a league with no rules (before #25). */
  pickSeconds: v.union(v.number(), v.null()),
  /** The caller's own team's auto-pick (#1100): whether it is on it, its timeouts so far, and how
   *  many put it on auto-pick (null: never, or a league with no rules); null for a caller who runs
   *  no team. */
  yourAutoPick: v.union(v.object({ on: v.boolean(), timeouts: v.number(), limit: v.union(v.number(), v.null()) }), v.null()),
  /** Each pick traded before the draft (#1096): `teamId`'s pick in `round`, which `ownerId` holds
   *  and makes now, so the board shows it under its owner, marked "via" `teamId` (spec/04, The
   *  picks). Empty until a pick is traded. */
  tradedPicks: v.array(v.object({ round: v.number(), teamId: v.id("teams"), ownerId: v.id("teams") })),
  /** The most players of one club a squad may hold under the rules the draft picks by: those it
   *  started under, or before it starts the league's latest, which it would start under; null for
   *  no limit. The selected player's panel counts the reader's squad against it. It is here, not in
   *  draftPlayers.ts `figures`, as this already reads the draft's row, which every pick writes
   *  (#1537). */
  maxPerClub: v.union(v.number(), v.null()),
});
export type DraftBoard = Infer<typeof draftBoard>;

/** The board as everyone in the league reads it: every pick made, first first, the caller's team,
 *  the draft's pick time and timeout limit, the league's latest (#1439), the picks traded, and the
 *  club maximum.
 *  It takes no minute, so the draft room doesn't blank as the minute turns (#1531). */
export const ofLeague = query({
  args: { leagueId: v.id("leagues") },
  returns: draftBoard,
  handler: async (ctx, { leagueId }) => {
    const { team } = await memberOf(ctx, leagueId);
    const rows = await ctx.db
      .query("draftPicks")
      .withIndex("by_leagueId_and_pick", (q) => q.eq("leagueId", leagueId))
      .collect();
    const positionsOf = await positionsNow(ctx, leagueId);
    const clubs = clubsByCode(ctx);
    const picks = await Promise.all(
      rows.map(async ({ pick, teamId, playerCode, auto, timeout }) => {
        // A pick made before #1100 has no `auto`, and only its `timeout` says the draft made it.
        const made = { pick, teamId, auto: auto === true || timeout !== undefined };
        const player = await playerByCode(ctx, playerCode);
        if (player === null) return { ...made, player: null };
        const [club, positions] = await Promise.all([clubs(player.clubCode), positionsOf(player.code)]);
        return { ...made, player: { code: player.code, name: player.name, clubShortName: club.shortName, position: positions[0] ?? null } };
      }),
    );
    // The draft's rules, the league's latest (#1439), and its own pick time once it has one.
    const latest = await latestRules(ctx, leagueId);
    const draftRules = draftRulesOf(latest);
    const draft = await draftOf(ctx, leagueId);
    const started = draft?.started;
    const squad = started === undefined ? latest.squad : await squadRulesOf(ctx, leagueId, started);
    let yourAutoPick: DraftBoard["yourAutoPick"] = null;
    if (team) {
      const timeouts = draft?.timeouts;
      const count = timeouts?.find(({ teamId }) => teamId === team._id)?.count ?? 0;
      yourAutoPick = { on: isOnAutoPick(timeouts, team._id), timeouts: count, limit: draftRules.timeoutsBeforeAutoPick };
    }
    return { picks, yourTeamId: team?._id ?? null, pickSeconds: pickSecondsOf(draft, draftRules), yourAutoPick, tradedPicks: draft?.tradedPicks ?? [], maxPerClub: squad?.maxPerClub ?? null };
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
