import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation, type QueryCtx } from "../_generated/server";
import { draftIsOver } from "../draft/draftRow";
import type { LeagueDeadlines } from "../gameweeks/deadline";
import { leagueDeadlines } from "../gameweeks/leagueDeadlines";
import { pickFirstLineupAgain } from "../lineup/lineups";
import { fileEvent, recordEvent } from "../mail/letters";
import { latestRules } from "../rules/rulesHistory";
import { managerOf, refuse, refusals } from "../shared/leagueAccess";
import { playerByCode } from "../shared/players";
import { placeOf } from "../squads/squadPlace";
import { inWaiverLock, latestBegun } from "./waiverLock";
import { waiverOrderRow } from "./waiverOrder";
import { dropFromSquad, waiverRowOf } from "./waiverPlayers";
import { joiningBreaksLimits } from "./waiverRun";
import { claimRefusals } from "./waiverClaims";
import { dropRefusals } from "./waivers";
import { closeOffersHolding, reviewHolding } from "../trades/tradeClose";

// A manager's free agent pickup (#1199, spec/08 Waivers and free agency): first come first served,
// in the window, from the first waiver run made after a gameweek until the next deadline. With a
// full squad he names who goes, and both happen at once, "like a trade with the waiver bin": the
// player he drops goes on waivers, or straight back to the free agents under the churn rule. A
// pickup that would break the squad's limits is refused, as a claim is at the run. The league gets
// a Mail letter for each.

export const pickUpRefusals = {
  notDrafted: claimRefusals.notDrafted,
  locked: "Free agents can't be picked up from the deadline until the gameweek's last match is over.",
  notOpen: "Free agents can be picked up from the first waiver run after a gameweek until the next deadline.",
  notFreeAgent: (name: string) => `${name} isn't a free agent.`,
  playerGone: claimRefusals.playerGone,
  dropNotYours: claimRefusals.dropNotYours,
  dropHeld: dropRefusals.held,
  limits: (name: string) => `Picking up ${name} would break your squad's limits.`,
};

/** Whether the window is open at `now`, the lock aside: no gameweek begun yet, or a waiver run
 *  made since the latest begun one's deadline. Made runs never fall in the lock, so one after the
 *  deadline came after the gameweek's last match. */
async function windowOpen(ctx: QueryCtx, leagueId: Id<"leagues">, deadlines: LeagueDeadlines, now: number): Promise<boolean> {
  const gameweek = latestBegun(deadlines, now);
  if (gameweek === null) return true;
  const deadline = deadlines.get(gameweek) ?? null;
  const madeAt = (await waiverOrderRow(ctx, leagueId))?.madeAt;
  return deadline !== null && madeAt !== undefined && madeAt > deadline;
}

/** The manager picks up a free agent, `dropCode` going for him at once, or nobody when null. */
export const pickUp = mutation({
  args: { leagueId: v.id("leagues"), playerCode: v.number(), dropCode: v.union(v.number(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { leagueId, playerCode, dropCode }) => {
    const { email, team } = await managerOf(ctx, leagueId);
    if (!(await draftIsOver(ctx, leagueId))) refuse(pickUpRefusals.notDrafted);
    const now = Date.now();
    const deadlines = await leagueDeadlines(ctx, leagueId);
    if (await inWaiverLock(ctx, deadlines, now)) refuse(pickUpRefusals.locked);
    if (!(await windowOpen(ctx, leagueId, deadlines, now))) refuse(pickUpRefusals.notOpen);
    const player = (await playerByCode(ctx, playerCode)) ?? refuse(refusals.noPlayer);
    if ((await placeOf(ctx, leagueId, playerCode)) !== null || (await waiverRowOf(ctx, leagueId, playerCode)) !== null) {
      refuse(pickUpRefusals.notFreeAgent(player.name));
    }
    if (player.droppedAt !== undefined) refuse(pickUpRefusals.playerGone(player.name));
    const drop = dropCode === null ? null : { player: (await playerByCode(ctx, dropCode)) ?? refuse(refusals.noPlayer), place: await placeOf(ctx, leagueId, dropCode) };
    if (drop !== null && drop.place?.teamId !== team._id) refuse(pickUpRefusals.dropNotYours(drop.player.name));
    if (drop !== null && (await reviewHolding(ctx, leagueId, drop.player.code)) !== null) refuse(pickUpRefusals.dropHeld(drop.player.name));
    const squadRules = (await latestRules(ctx, leagueId))?.squad ?? null;
    if (await joiningBreaksLimits(ctx, leagueId, team._id, playerCode, dropCode, squadRules)) refuse(pickUpRefusals.limits(player.name));

    const onTeam = { teamId: team._id, teamName: team.name };
    let dropped = null;
    if (drop?.place) {
      const toWaivers = await dropFromSquad(ctx, drop.place, deadlines, now);
      dropped = { playerCode: drop.place.playerCode, playerName: drop.player.name, toWaivers };
      await fileEvent(ctx, leagueId, email, { kind: "playerDropped", ...dropped, ...onTeam });
      await closeOffersHolding(ctx, leagueId, team._id, [dropped.playerCode]);
    }
    await ctx.db.insert("squadPlayers", { leagueId, teamId: team._id, playerCode, pickedUpAt: now });
    await recordEvent(ctx, leagueId, email, { kind: "playerPickedUp", playerCode, playerName: player.name, ...onTeam, dropped });
    await pickFirstLineupAgain(ctx, leagueId, team._id);
    return null;
  },
});
