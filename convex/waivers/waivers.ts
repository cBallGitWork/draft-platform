import { v, type Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import { draftIsLive } from "../draft/draftRow";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { pickFirstLineupAgain } from "../lineup/lineups";
import { recordEvent } from "../mail/letters";
import { managerOf, memberOf, refuse, refusals, teamIn } from "../shared/leagueAccess";
import { playerByCode } from "../shared/players";
import { tellShortlisters } from "../scouting/shortlist";
import { placeOf } from "../squads/squadPlace";
import { squadRefusals } from "../squads/squads";
import { inWaiverLock } from "./waiverLock";
import { dropFromSquad, waiverRowOf } from "./waiverPlayers";

// A manager's drop, and a player's waiver state (#1197, spec/08 Waivers and free agency). A drop
// is a release by the manager: the player leaves the squad, the league is told in Mail, as is each
// manager whose shortlist holds him (../scouting/shortlist.ts), and the
// team's first lineup is picked again, as the commissioner's release does (../squads/squads.ts).
// He goes on waivers for at least 24 hours, unless the churn rule sends him straight back to the
// free agents: picked up as one and dropped before a deadline has passed. Dropping is never
// restricted but in the lock (waiverLock.ts) and while the draft is live, when only its picks
// change squads.

export const dropRefusals = {
  draftLive: squadRefusals.draftLive,
  locked: "Players can't be dropped from the deadline until the gameweek's last match is over.",
  notYours: (name: string) => `${name} isn't in your squad.`,
};

/** The manager drops a player from his own squad, onto waivers or, under the churn rule, back to
 *  the free agents. */
export const drop = mutation({
  args: { leagueId: v.id("leagues"), playerCode: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, playerCode }) => {
    const { email, league, team } = await managerOf(ctx, leagueId);
    if (await draftIsLive(ctx, leagueId)) refuse(dropRefusals.draftLive);
    const now = Date.now();
    const deadlines = await leagueDeadlines(ctx, leagueId);
    if (await inWaiverLock(ctx, deadlines, now)) refuse(dropRefusals.locked);
    const player = (await playerByCode(ctx, playerCode)) ?? refuse(refusals.noPlayer);
    const place = await placeOf(ctx, leagueId, playerCode);
    if (place === null || place.teamId !== team._id) refuse(dropRefusals.notYours(player.name));
    const toWaivers = await dropFromSquad(ctx, place, deadlines, now);
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
