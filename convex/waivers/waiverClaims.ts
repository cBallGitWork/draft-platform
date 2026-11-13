import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { positionsNow } from "../positions/playerPositions";
import { clubRecord, position } from "../schema";
import { takeAllOrThrow } from "../shared/cappedRead";
import { MOST_TEAMS } from "../leagues/leagueLimits";
import { managerOf, memberOf, ownTeamOrNone, playerOrRefuse, powersIn, refuse, teamsOf } from "../shared/leagueAccess";
import { clubByCode, clubOf, heldPlayerByCode } from "../shared/players";
import { placeOf } from "../squads/squadPlace";
import { squadRefusals } from "../squads/squads";
import { seasonPointsIn } from "../stats/seasonPoints";
import { firstRunsIn, outOfLockFor, runAhead, waiversOpenFor } from "./waiverLock";
import { CLAIMS_PER_TEAM_MOST } from "./waiverLimits";
import { waiverRowOf } from "./waiverPlayers";
import { dropRefusals } from "./waivers";

// A manager's waiver claims (#1198, spec/08 Waivers and free agency): as many as he likes, ranked,
// each for a player on waivers and, with a full squad, naming who he drops if it succeeds. He puts
// one in, withdraws it, changes who it drops, the claim keeping its rank (Craig, 6 Nov 2026, on
// #1200: "Change the drop on the claim"), and ranks them again; the run (waiverRun.ts) tries them. No claim is put in
// from the deadline until the gameweek's last match is over, nor until the draft is over. A manager
// sees only his own pending claims; the commissioner sees everyone's.

export const claimRefusals = {
  notDrafted: dropRefusals.notDrafted,
  locked: "Claims can't be put in from the deadline until the gameweek's last match is over.",
  notOnWaivers: (name: string) => `${name} isn't on waivers.`,
  playerGone: squadRefusals.playerGone,
  dropNotYours: dropRefusals.notYours,
  twice: "You have that claim in already.",
  tooMany: `You have ${CLAIMS_PER_TEAM_MOST} claims in, the most a team can: withdraw one before putting in another.`,
  notYours: "That claim isn't one of your pending claims.",
  claimsChanged: "Your claims changed since you opened them, so their order wasn't saved.",
};

/** The most claims a league holds that one read takes: every team at its ceiling (#1609), so the
 *  run never meets it. Past it a read throws rather than leave claims out. */
const CLAIMS_READ_MOST = MOST_TEAMS * CLAIMS_PER_TEAM_MOST;

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

/** Withdraws every pending claim of the team whose manager has just been removed or left, so none
 *  is tried for a team nobody runs and the next manager starts with none (Craig, 11 Nov 2026, on #1464). */
export async function withdrawClaimsOfTeam(ctx: MutationCtx, team: Doc<"teams">): Promise<void> {
  for (const claim of await claimsOf(ctx, team.leagueId, team._id)) await ctx.db.delete("waiverClaims", claim._id);
}

/** The log line for a claim naming a player the football sync doesn't hold. */
const unheldClaimWords = (playerCode: number) => `A waiver claim names player ${playerCode}, whom the football sync doesn't hold`;

/** The name of a player a claim names, to claim or to drop: one is put in only for players the
 *  football sync holds, and it never deletes one. */
export async function claimedName(ctx: QueryCtx, playerCode: number): Promise<string> {
  return (await heldPlayerByCode(ctx, playerCode, unheldClaimWords(playerCode))).name;
}

/** The manager claims a player on waivers, last of his claims, naming who he drops if it succeeds,
 *  if anyone. Its id. Refused while his team has CLAIMS_PER_TEAM_MOST in (Craig, 11 Nov 2026, #1609). */
export const putIn = mutation({
  args: { leagueId: v.id("leagues"), playerCode: v.number(), dropCode: v.union(v.number(), v.null()) },
  returns: v.id("waiverClaims"),
  handler: async (ctx, { leagueId, playerCode, dropCode }) => {
    const { email, team } = await managerOf(ctx, leagueId);
    await waiversOpenFor(ctx, leagueId, claimRefusals);
    const player = await playerOrRefuse(ctx, playerCode);
    if ((await waiverRowOf(ctx, leagueId, playerCode)) === null) refuse(claimRefusals.notOnWaivers(player.name));
    if (player.droppedAt !== undefined) refuse(claimRefusals.playerGone(player.name));
    await checkDrop(ctx, leagueId, team._id, dropCode);
    const claims = await claimsOf(ctx, leagueId, team._id);
    if (claims.some((claim) => claim.playerCode === playerCode && claim.dropCode === dropCode)) refuse(claimRefusals.twice);
    if (claims.length >= CLAIMS_PER_TEAM_MOST) refuse(claimRefusals.tooMany);
    const rank = (claims.at(-1)?.rank ?? -1) + 1;
    return await ctx.db.insert("waiverClaims", { leagueId, teamId: team._id, playerCode, dropCode, rank, by: email });
  },
});

/** Refused unless a claim's drop, if anyone, is in the team's squad. */
async function checkDrop(ctx: QueryCtx, leagueId: Id<"leagues">, teamId: Id<"teams">, dropCode: number | null): Promise<void> {
  if (dropCode === null) return;
  const drop = await playerOrRefuse(ctx, dropCode);
  if ((await placeOf(ctx, leagueId, dropCode))?.teamId !== teamId) refuse(claimRefusals.dropNotYours(drop.name));
}

/** The manager's claim, or the refusal that it isn't one of his. */
async function ownClaim(ctx: QueryCtx, leagueId: Id<"leagues">, claimId: Id<"waiverClaims">) {
  const { team } = await managerOf(ctx, leagueId);
  const claim = await ctx.db.get("waiverClaims", claimId);
  if (claim === null || claim.leagueId !== leagueId || claim.teamId !== team._id) refuse(claimRefusals.notYours);
  return claim;
}

/** The manager withdraws one of his pending claims: in the lock too, only new claims being shut
 *  there (Craig, 11 Nov 2026, on #1590), as for `rank`. */
export const withdraw = mutation({
  args: { leagueId: v.id("leagues"), claimId: v.id("waiverClaims") },
  returns: v.null(),
  handler: async (ctx, { leagueId, claimId }) => {
    await ctx.db.delete("waiverClaims", (await ownClaim(ctx, leagueId, claimId))._id);
    return null;
  },
});

/** The manager changes who one of his pending claims drops if it succeeds, or names nobody; the
 *  claim keeps its rank. Refused as putting one in is: in the lock, for a player not in his squad,
 *  or when it would match another of his claims. */
export const changeDrop = mutation({
  args: { leagueId: v.id("leagues"), claimId: v.id("waiverClaims"), dropCode: v.union(v.number(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { leagueId, claimId, dropCode }) => {
    const claim = await ownClaim(ctx, leagueId, claimId);
    await outOfLockFor(ctx, leagueId, claimRefusals.locked);
    await checkDrop(ctx, leagueId, claim.teamId, dropCode);
    const others = (await claimsOf(ctx, leagueId, claim.teamId)).filter(({ _id }) => _id !== claimId);
    if (others.some((other) => other.playerCode === claim.playerCode && other.dropCode === dropCode)) refuse(claimRefusals.twice);
    await ctx.db.patch("waiverClaims", claimId, { dropCode });
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

/** How many pending claims the caller's own team has, for the count on My team's Transactions tab
 *  (Craig, 8 Nov 2026, on #1200: "Yes 1 and 2"). The frame asks it on every page, so it answers 0,
 *  never a refusal, for anyone signed out, outside the league or running no team in it. */
export const countMine = query({
  args: { leagueId: v.id("leagues") },
  returns: v.number(),
  handler: async (ctx, { leagueId }) => {
    const own = await ownTeamOrNone(ctx, leagueId);
    return own === null ? 0 : (await claimsOf(ctx, leagueId, own.team._id)).length;
  },
});

/** A player a pending claim names, to claim or to drop, as the Transactions tab lists him. */
const claimedPlayer = v.object({
  playerCode: v.number(),
  playerName: v.string(),
  positions: v.array(position),
  club: clubRecord,
  /** His points this season, as on the players list, or null while none of his matches is priced. */
  seasonPoints: v.union(v.number(), v.null()),
});

const pendingClaim = v.object({
  claimId: v.id("waiverClaims"),
  teamId: v.id("teams"),
  teamName: v.string(),
  /** Whether it is the caller's own team's: the commissioner sees every team's too. */
  yours: v.boolean(),
  claim: claimedPlayer,
  /** Who goes if it succeeds, or null for nobody. */
  drop: v.union(claimedPlayer, v.null()),
  /** The run that can first take the player, still to come, and the gameweek whose lock it may fall
   *  in (waiverLock.ts `firstRunTaking`): null with no run times set, or once he is no longer on
   *  waivers, when the next run fails the claim. */
  run: v.union(runAhead, v.null()),
});
export type PendingClaim = Infer<typeof pendingClaim>;

/** Pending claims at `now`, team by team in the order the teams were made, each team's first
 *  first: the caller's own team's, or every team's for whoever runs the league. */
export const pending = query({
  args: { leagueId: v.id("leagues"), now: v.number() },
  returns: v.array(pendingClaim),
  handler: async (ctx, { leagueId, now }): Promise<PendingClaim[]> => {
    const { email, league, team } = await memberOf(ctx, leagueId);
    const teams = await teamsOf(ctx, leagueId);
    const shown = powersIn(league, email).runs ? teams : teams.filter(({ _id }) => _id === team?._id);
    const claims = (await Promise.all(shown.map(async (owner) => (await claimsOf(ctx, leagueId, owner._id)).map((claim) => ({ owner, claim }))))).flat();
    const codes = [...new Set(claims.flatMap(({ claim }) => (claim.dropCode === null ? [claim.playerCode] : [claim.playerCode, claim.dropCode])))];
    const positionsOf = await positionsNow(ctx, leagueId);
    const seasonPointsOf = await seasonPointsIn(ctx, leagueId, codes);
    const firstRunOf = await firstRunsIn(ctx, leagueId, now);
    const described = async (playerCode: number) => {
      const player = await heldPlayerByCode(ctx, playerCode, unheldClaimWords(playerCode));
      const positions = await positionsOf(playerCode);
      return { playerCode, playerName: player.name, positions, club: clubOf(await clubByCode(ctx, player.clubCode)), seasonPoints: seasonPointsOf(playerCode, positions) };
    };
    return Promise.all(
      claims.map(async ({ owner, claim }) => {
        const onWaivers = await waiverRowOf(ctx, leagueId, claim.playerCode);
        return {
          claimId: claim._id,
          teamId: owner._id,
          teamName: owner.name,
          yours: owner._id === team?._id,
          claim: await described(claim.playerCode),
          drop: claim.dropCode === null ? null : await described(claim.dropCode),
          run: onWaivers === null ? null : firstRunOf(onWaivers.claimableFrom),
        };
      }),
    );
  },
});
