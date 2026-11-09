import { v, type Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import { draftIsOver } from "../draft/draftRow";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { pickFirstLineupAgain } from "../lineup/lineups";
import { recordEvent } from "../mail/letters";
import { managerOf, memberOf, refuse, refusals, teamIn } from "../shared/leagueAccess";
import { playerByCode } from "../shared/players";
import { tellShortlisters } from "../scouting/shortlist";
import { latestRules } from "../rules/rulesHistory";
import { heldOrNot, placeOf, squadOf } from "../squads/squadPlace";
import { closeOffersHolding, reviewHolding } from "../trades/tradeClose";
import { inWaiverLock } from "./waiverLock";
import { dropFromSquad, waiverRowOf } from "./waiverPlayers";
import { firstRunFrom } from "./waiverTimes";

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
    if (!(await draftIsOver(ctx, leagueId))) refuse(dropRefusals.notDrafted);
    const now = Date.now();
    const deadlines = await leagueDeadlines(ctx, leagueId);
    if (await inWaiverLock(ctx, deadlines, now)) refuse(dropRefusals.locked);
    const player = (await playerByCode(ctx, playerCode)) ?? refuse(refusals.noPlayer);
    const place = await placeOf(ctx, leagueId, playerCode);
    if (place === null || place.teamId !== team._id) refuse(dropRefusals.notYours(player.name));
    if ((await reviewHolding(ctx, leagueId, playerCode)) !== null) refuse(dropRefusals.held(player.name));
    const toWaivers = await dropFromSquad(ctx, place, deadlines, now);
    await closeOffersHolding(ctx, leagueId, team._id, [playerCode]);
    await recordEvent(ctx, leagueId, email, {
      kind: "playerDropped",
      playerCode,
      playerName: player.name,
      teamId: team._id,
      teamName: team.name,
      toWaivers,
    });
    await tellShortlisters(ctx, league, player, team, email, { released: false, toWaivers });
    await pickFirstLineupAgain(ctx, leagueId, team._id);
    return null;
  },
});

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

/** A player a claim or the card names, by code and name. */
export const namedPlayer = v.object({ playerCode: v.number(), playerName: v.string() });

const cardAction = v.union(
  /** Nothing to do: he is on another team, or the caller runs no team in the league. */
  v.object({ kind: v.literal("none") }),
  /** He is in the caller's squad. */
  v.object({ kind: v.literal("drop") }),
  /** On waivers: `firstRunAt` is the run that can first take him, or null with no run times set. */
  v.object({ kind: v.literal("claim"), firstRunAt: v.union(v.number(), v.null()), squad: v.array(namedPlayer) }),
  v.object({ kind: v.literal("pickUp"), squad: v.array(namedPlayer) }),
);
export type CardAction = Infer<typeof cardAction>;

/** What the player card offers the caller on this player (spec/12, the player card's actions;
 *  spec/08): drop him from his own squad, claim him off waivers or pick him up as a free agent,
 *  with the caller's squad, by name, to name who goes. Whether the change is open now is the
 *  mutation's to judge, so its refusal says why. */
export const cardActionOn = query({
  args: { leagueId: v.id("leagues"), playerCode: v.number() },
  returns: cardAction,
  handler: async (ctx, { leagueId, playerCode }): Promise<CardAction> => {
    const { team } = await memberOf(ctx, leagueId);
    if (!team || (await playerByCode(ctx, playerCode)) === null) return { kind: "none" };
    const place = await placeOf(ctx, leagueId, playerCode);
    if (place !== null) return { kind: place.teamId === team._id ? "drop" : "none" };
    const { held } = await heldOrNot(ctx, await squadOf(ctx, team._id));
    const squad = held.map(({ player }) => ({ playerCode: player.code, playerName: player.name })).sort((one, other) => one.playerName.localeCompare(other.playerName));
    const onWaivers = await waiverRowOf(ctx, leagueId, playerCode);
    if (onWaivers === null) return { kind: "pickUp", squad };
    const runs = (await latestRules(ctx, leagueId)).waivers.runs;
    return { kind: "claim", firstRunAt: firstRunFrom(runs, onWaivers.claimableFrom), squad };
  },
});
