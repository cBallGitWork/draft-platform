import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { pickFirstLineupAgain } from "../lineup/lineups";
import { managerOf, memberOf, playerOrRefuse, refuse, refusals, teamIn } from "../shared/leagueAccess";
import { playerByCode } from "../shared/players";
import { namedPlayer } from "../schema";
import { heldOrNot, placeOf, squadOf } from "../squads/squadPlace";
import { heldInReview } from "../trades/tradeClose";
import { firstRunsIn, runAhead, waiversOpenFor } from "./waiverLock";
import { dropAndTell, waiverRowOf } from "./waiverPlayers";

// A manager's drop, and a player's waiver state (#1197, spec/08 Waivers and free agency). A drop
// is a release by the manager: the player leaves the squad, the league is told in Mail, as is each
// manager whose shortlist holds him (../scouting/shortlist.ts), and the
// team's first lineup is picked again, as the commissioner's release does (../squads/squads.ts).
// He goes on waivers for at least 24 hours, unless the churn rule sends him straight back to the
// free agents: picked up as one and dropped before a deadline has passed. Dropping is never
// restricted but in the lock (waiverLock.ts) and until the draft is over (#1326): before it,
// and while only its picks change squads.

export const dropRefusals = {
  /** spec/08 (Craig, 8 Nov 2026, #1326): nothing moves before the draft is over, nor while it is live. */
  notDrafted: "Free agency and waivers open once the league's draft is over.",
  locked: "Players can't be dropped from the deadline until the gameweek's last match is over.",
  notYours: (name: string) => `${name} isn't in your squad.`,
  /** spec/08 (Craig, 6 Nov 2026, on #383): a player in a trade under review is held. */
  held: (name: string) => `${name} is in a trade under review, so he can't be dropped until it finishes.`,
};

/** The manager drops a player from his own squad, onto waivers or, under the churn rule, back to
 *  the free agents. */
export const drop = mutation({
  args: { leagueId: v.id("leagues"), playerCode: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, playerCode }) => {
    const { email, league, team } = await managerOf(ctx, leagueId);
    const { deadlines, now } = await waiversOpenFor(ctx, leagueId, dropRefusals);
    const player = await playerOrRefuse(ctx, playerCode);
    const place = await placeToDrop(ctx, leagueId, team._id, player);
    await dropAndTell(ctx, league, team, place, player, email, { deadlines, now, letter: true });
    await pickFirstLineupAgain(ctx, leagueId, team._id);
    return null;
  },
});

/** The squad place of the player the manager's team drops, by itself or for a pickup: refused
 *  unless he is in its squad and not held in a trade under review. */
export async function placeToDrop(ctx: QueryCtx, leagueId: Id<"leagues">, teamId: Id<"teams">, player: { code: number; name: string }): Promise<Doc<"squadPlayers">> {
  const place = await placeOf(ctx, leagueId, player.code);
  if (place === null || place.teamId !== teamId) refuse(dropRefusals.notYours(player.name));
  if ((await heldInReview(ctx, leagueId)).has(player.code)) refuse(dropRefusals.held(player.name));
  return place;
}

const waiverState = v.union(
  v.object({ kind: v.literal("owned"), teamId: v.id("teams"), teamName: v.string() }),
  /** On waivers: a run may take him from `claimableFrom` on (waiverRun.ts). */
  v.object({ kind: v.literal("onWaivers"), claimableFrom: v.number() }),
  v.object({ kind: v.literal("freeAgent") }),
);
export type WaiverState = Infer<typeof waiverState>;

/** A player's waiver state in the league: on a team, on waivers until a run may take him, or a
 *  free agent. Anyone with a part in the league sees it. */
export const stateOf = query({
  args: { leagueId: v.id("leagues"), playerCode: v.number() },
  returns: waiverState,
  handler: async (ctx, { leagueId, playerCode }): Promise<WaiverState> => {
    await memberOf(ctx, leagueId);
    if ((await playerByCode(ctx, playerCode)) === null) refuse(refusals.noPlayer);
    const place = await placeOf(ctx, leagueId, playerCode);
    if (place !== null) return { kind: "owned", teamId: place.teamId, teamName: (await teamIn(ctx, leagueId, place.teamId)).name };
    const onWaivers = await waiverRowOf(ctx, leagueId, playerCode);
    return onWaivers === null ? { kind: "freeAgent" } : { kind: "onWaivers", claimableFrom: onWaivers.claimableFrom };
  },
});

const cardAction = v.union(
  /** Nothing to do: he is on another team, or the caller runs no team in the league. */
  v.object({ kind: v.literal("none") }),
  /** He is in the caller's squad. */
  v.object({ kind: v.literal("drop") }),
  /** On waivers: `firstRun` is the run that can first take him, still to come, and the gameweek
   *  whose lock it may fall in (waiverLock.ts `firstRunTaking`), or null with no run times set. */
  v.object({ kind: v.literal("claim"), firstRun: v.union(runAhead, v.null()), squad: v.array(namedPlayer) }),
  v.object({ kind: v.literal("pickUp"), squad: v.array(namedPlayer) }),
);
export type CardAction = Infer<typeof cardAction>;

/** What the player card offers the caller on this player (spec/12, the player card's actions;
 *  spec/08): drop him from his own squad, claim him off waivers or pick him up as a free agent,
 *  with the caller's squad, by name, to name who goes. Whether the change is open now is the
 *  mutation's to judge, so its refusal says why. The run that can first take him is as of `now`. */
export const cardActionOn = query({
  args: { leagueId: v.id("leagues"), playerCode: v.number(), now: v.number() },
  returns: cardAction,
  handler: async (ctx, { leagueId, playerCode, now }): Promise<CardAction> => {
    const { team } = await memberOf(ctx, leagueId);
    const player = await playerByCode(ctx, playerCode);
    if (!team || player === null) return { kind: "none" };
    const place = await placeOf(ctx, leagueId, playerCode);
    if (place !== null) return { kind: place.teamId === team._id ? "drop" : "none" };
    const { held } = await heldOrNot(ctx, await squadOf(ctx, team._id));
    const squad = held.map(({ player }) => ({ playerCode: player.code, playerName: player.name })).sort((one, other) => one.playerName.localeCompare(other.playerName));
    const onWaivers = await waiverRowOf(ctx, leagueId, playerCode);
    // One who has left the Premier League is no free agent: nothing to pick up (#1469).
    if (onWaivers === null) return player.droppedAt === undefined ? { kind: "pickUp", squad } : { kind: "none" };
    return { kind: "claim", firstRun: (await firstRunsIn(ctx, leagueId, now))(onWaivers.claimableFrom), squad };
  },
});
