import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { draftIsLive } from "../draft/draftRow";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { takeAllOrThrow } from "../shared/cappedRead";
import { managerOf, memberOf, powersIn, refuse, refusals, teamsOf } from "../shared/leagueAccess";
import { playerByCode } from "../shared/players";
import { placeOf } from "../squads/squadPlace";
import { inWaiverLock } from "./waiverLock";
import { waiverRowOf } from "./waiverPlayers";
import { dropRefusals } from "./waivers";

// A manager's waiver claims (#1198, spec/08 Waivers and free agency): as many as he likes, ranked,
// each for a player on waivers and, with a full squad, naming who he drops if it succeeds. He puts
// one in, withdraws it and ranks them again; the run (waiverRun.ts) tries them. No claim is put in
// from the deadline until the gameweek's last match is over, nor while the draft is live. A manager
// sees only his own pending claims; the commissioner sees everyone's.

export const claimRefusals = {
  draftLive: dropRefusals.draftLive,
  locked: "Claims can't be put in from the deadline until the gameweek's last match is over.",
  notOnWaivers: (name: string) => `${name} isn't on waivers.`,
  dropNotYours: dropRefusals.notYours,
  twice: "You have that claim in already.",
  notYours: "That claim isn't one of your pending claims.",
  claimsChanged: "Your claims changed since you opened them, so their order wasn't saved.",
};

/** The most claims a league holds that one read takes: Claude's sizing, far above the players on
 *  waivers at once times the teams. Past it a read throws rather than leave claims out. */
export const CLAIMS_READ_MOST = 2000;

/** The team's pending claims, first first. */
export function claimsOf(ctx: QueryCtx, leagueId: Id<"leagues">, teamId: Id<"teams">): Promise<Doc<"waiverClaims">[]> {
  return takeAllOrThrow(
    ctx.db.query("waiverClaims").withIndex("by_leagueId_and_teamId_and_rank", (q) => q.eq("leagueId", leagueId).eq("teamId", teamId)),
    CLAIMS_READ_MOST,
    `Team ${teamId} has more than ${CLAIMS_READ_MOST} claims, so they can't all be read`,
  );
}

/** Every pending claim in the league, team by team, each team's first first. */
export function leagueClaims(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"waiverClaims">[]> {
  return takeAllOrThrow(
    ctx.db.query("waiverClaims").withIndex("by_leagueId_and_teamId_and_rank", (q) => q.eq("leagueId", leagueId)),
    CLAIMS_READ_MOST,
    `League ${leagueId} has more than ${CLAIMS_READ_MOST} claims, so they can't all be read`,
  );
}

/** The manager claims a player on waivers, last of his claims, naming who he drops if it succeeds,
 *  if anyone. Its id. */
export const putIn = mutation({
  args: { leagueId: v.id("leagues"), playerCode: v.number(), dropCode: v.union(v.number(), v.null()) },
  returns: v.id("waiverClaims"),
  handler: async (ctx, { leagueId, playerCode, dropCode }) => {
    const { email, team } = await managerOf(ctx, leagueId);
    if (await draftIsLive(ctx, leagueId)) refuse(claimRefusals.draftLive);
    if (await inWaiverLock(ctx, await leagueDeadlines(ctx, leagueId), Date.now())) refuse(claimRefusals.locked);
    const player = (await playerByCode(ctx, playerCode)) ?? refuse(refusals.noPlayer);
    if ((await waiverRowOf(ctx, leagueId, playerCode)) === null) refuse(claimRefusals.notOnWaivers(player.name));
    if (dropCode !== null) {
      const drop = (await playerByCode(ctx, dropCode)) ?? refuse(refusals.noPlayer);
      if ((await placeOf(ctx, leagueId, dropCode))?.teamId !== team._id) refuse(claimRefusals.dropNotYours(drop.name));
    }
    const claims = await claimsOf(ctx, leagueId, team._id);
    if (claims.some((claim) => claim.playerCode === playerCode && claim.dropCode === dropCode)) refuse(claimRefusals.twice);
    const rank = (claims.at(-1)?.rank ?? -1) + 1;
    return await ctx.db.insert("waiverClaims", { leagueId, teamId: team._id, playerCode, dropCode, rank, by: email });
  },
});

/** The manager's claim, or the refusal that it isn't one of his. */
async function ownClaim(ctx: QueryCtx, leagueId: Id<"leagues">, claimId: Id<"waiverClaims">) {
  const { team } = await managerOf(ctx, leagueId);
  const claim = await ctx.db.get("waiverClaims", claimId);
  if (claim === null || claim.leagueId !== leagueId || claim.teamId !== team._id) refuse(claimRefusals.notYours);
  return claim;
}

/** The manager withdraws one of his pending claims. */
export const withdraw = mutation({
  args: { leagueId: v.id("leagues"), claimId: v.id("waiverClaims") },
  returns: v.null(),
  handler: async (ctx, { leagueId, claimId }) => {
    await ctx.db.delete("waiverClaims", (await ownClaim(ctx, leagueId, claimId))._id);
    return null;
  },
});

/** The manager ranks his pending claims again: `claimIds` are all of them, first first. Refused
 *  unless they are, each once: one was put in, withdrawn or tried since the screen read them. */
export const rank = mutation({
  args: { leagueId: v.id("leagues"), claimIds: v.array(v.id("waiverClaims")) },
  returns: v.null(),
  handler: async (ctx, { leagueId, claimIds }) => {
    const { team } = await managerOf(ctx, leagueId);
    const held = new Set((await claimsOf(ctx, leagueId, team._id)).map((claim) => claim._id));
    if (new Set(claimIds).size !== claimIds.length || claimIds.length !== held.size || claimIds.some((id) => !held.has(id))) {
      refuse(claimRefusals.claimsChanged);
    }
    for (const [rank, claimId] of claimIds.entries()) await ctx.db.patch("waiverClaims", claimId, { rank });
    return null;
  },
});

const namedPlayer = v.object({ playerCode: v.number(), playerName: v.string() });

const pendingClaim = v.object({
  claimId: v.id("waiverClaims"),
  teamId: v.id("teams"),
  teamName: v.string(),
  claim: namedPlayer,
  /** Who goes if it succeeds, or null for nobody. */
  drop: v.union(namedPlayer, v.null()),
});

/** Pending claims, team by team in the order the teams were made, each team's first first: the
 *  caller's own team's, or every team's for whoever runs the league. */
export const pending = query({
  args: { leagueId: v.id("leagues") },
  returns: v.array(pendingClaim),
  handler: async (ctx, { leagueId }) => {
    const { email, league, team } = await memberOf(ctx, leagueId);
    const teams = await teamsOf(ctx, leagueId);
    const shown = powersIn(league, email).runs ? teams : teams.filter(({ _id }) => _id === team?._id);
    const named = async (playerCode: number) => {
      const player = await playerByCode(ctx, playerCode);
      // A claim is put in only for a player the football sync holds, and it never deletes one.
      if (player === null) throw new Error(`A claim in league ${leagueId} names player ${playerCode}, whom the football sync doesn't hold`);
      return { playerCode, playerName: player.name };
    };
    const claims = await Promise.all(
      shown.map(async ({ _id, name }) =>
        Promise.all(
          (await claimsOf(ctx, leagueId, _id)).map(async (claim) => ({
            claimId: claim._id,
            teamId: _id,
            teamName: name,
            claim: await named(claim.playerCode),
            drop: claim.dropCode === null ? null : await named(claim.dropCode),
          })),
        ),
      ),
    );
    return claims.flat();
  },
});
