import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, type MutationCtx } from "../_generated/server";
import { startAfterDraft } from "../gameweeks/scoringStart";
import { pickFirstLineupAgain, saveFirstLineup } from "../lineup/lineups";
import { fileEvent } from "../mail/letters";
import { refuse, managerOf, teamIn, teamsOf } from "../shared/leagueAccess";
import { heldPlayerByCode } from "../shared/players";
import { placeOf } from "../squads/squadPlace";
import { clockedOf, scheduleAutoPick, startClock } from "./draftClock";
import { tellDraftOver, tellScoringStartMoved, tellUpNext } from "./draftLetters";
import { draftRulesNow, pickRefusals, pickSecondsNow } from "./draftPicks";
import { draftOf, lastPickIn, undoWindowOpen } from "./draftRow";

// The 10 seconds after each pick (spec/04, The draft room; #1458). Every pick's next clock waits 10
// seconds (draftClock.ts), and in them the manager who made the pick himself can undo it, a pause
// freezing them (Craig, 4 Nov 2026, on #1090 and #1091): his pick goes back on the clock with the
// time it had left, telling no one. The next manager is told he is up next only once they are up,
// and after the last pick the draft ends only then (Craig, 11 Nov 2026, on #1458: "After his own
// undo he gets the time he had left. The next manager's "you're up next" waits until the 10 seconds
// end; his own undo sends no letter; it works while paused, with the window frozen"). The
// commissioner's undo (draftCommissioner.ts) takes a pick back the same way.

/** The draft's last pick taken back: its player leaves the squad, free to pick again, filed as
 *  released by `by`, and its team's first lineup is picked again. Returns its team and player. The
 *  caller puts the pick back on the clock. */
export async function takeBackPick(ctx: MutationCtx, leagueId: Id<"leagues">, last: Doc<"draftPicks">, by: string): Promise<{ team: Doc<"teams">; player: Doc<"players"> }> {
  const team = await teamIn(ctx, leagueId, last.teamId);
  const player = await heldPlayerByCode(ctx, last.playerCode, `Player ${last.playerCode}, drafted at pick ${last.pick}, isn't in the football data`);
  const place = await placeOf(ctx, leagueId, last.playerCode);
  if (place?.teamId !== last.teamId) throw new Error(`League ${leagueId}'s pick ${last.pick} put player ${last.playerCode} on team ${last.teamId}, but he isn't in its squad`);
  await ctx.db.delete("squadPlayers", place._id);
  await ctx.db.delete("draftPicks", last._id);
  await fileEvent(ctx, leagueId, by, { kind: "playerReleased", playerCode: player.code, playerName: player.name, teamId: team._id, teamName: team.name });
  await pickFirstLineupAgain(ctx, leagueId, team._id);
  return { team, player };
}

/** The manager undoes his own pick in its 10 seconds: its player leaves his squad, and his pick is
 *  back on the clock at once with the time it had left when he made it, telling no one. While the
 *  draft is paused it stays paused, his clock starting when the commissioner resumes. Refused
 *  before the draft starts, when the last pick isn't one he made himself, an auto-pick or the
 *  commissioner's among them, and once its 10 seconds are up. */
export const undoMyPick = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const { email, team } = await managerOf(ctx, leagueId);
    const draft = await draftOf(ctx, leagueId);
    if (draft?.started === undefined) refuse(pickRefusals.notStarted);
    const last = await lastPickIn(ctx, leagueId);
    if (last?.own === undefined || last.teamId !== team._id) refuse(pickRefusals.noOwnPick);
    const now = Date.now();
    if (!undoWindowOpen(draft, last, now)) refuse(pickRefusals.undoOver);
    await takeBackPick(ctx, leagueId, last, email);
    const clock = draft.clock;
    if (clock?.job !== undefined) await ctx.scheduler.cancel(clock.job);
    const pausedAt = clock?.paused === undefined ? undefined : now;
    const clocked = await startClock(ctx, leagueId, last.pick - 1, now, await pickSecondsNow(ctx, leagueId), { pausedAt, leftMs: last.own.leftMs });
    if (clocked === null) throw new Error(`League ${leagueId}'s pick ${last.pick} was undone, but it can't be put back on the clock`);
    return null;
  },
});

/** Tells the manager of the pick on the clock that he is up next as its clock starts, the 10
 *  seconds to undo the pick before it up, then schedules the pick the draft makes for his team
 *  (draftClock.ts `scheduleAutoPick`). Does nothing once `pick` is no longer on the clock, or while
 *  the draft is paused: an undo or a resume starts the clock again. */
export const clockStarts = internalMutation({
  args: { leagueId: v.id("leagues"), pick: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, pick }) => {
    const [league, draft] = await Promise.all([ctx.db.get("leagues", leagueId), draftOf(ctx, leagueId)]);
    const clock = draft?.clock;
    if (league === null || draft === null || clock?.pick !== pick || clock.upNext === undefined || clock.paused !== undefined) return null;
    // This job is the clock's own, so the clock goes on without it: cancelling it would cancel the next too.
    const { job: _job, upNext, ...started } = clock;
    const clocked = await clockedOf(ctx, draft, started);
    if (Date.now() < clock.startsAt) {
      await scheduleAutoPick(ctx, draft, { ...started, upNext }, clocked.team);
      return null;
    }
    await tellUpNext(ctx, league, clocked);
    await scheduleAutoPick(ctx, draft, started, clocked.team);
    return null;
  },
});

/** The draft ends, its last pick's 10 seconds up (draftClock.ts's closing clock): each team's
 *  lineup is saved as its picks left it (lineups.ts `saveFirstLineup`; #1040), the league's scoring
 *  start is set (scoringStart.ts `startAfterDraft`; #1097), the players nobody drafted go on waivers
 *  for the next run if its draft setting says so (#1197), in a job of their own so this stays clear
 *  of Convex's read limit (#1532), and the whole league is told the draft is over
 *  (draftLetters.ts), the commissioner too when the start moved. Does nothing while paused, once an
 *  undo has put a pick back on the clock, and once the league is gone. */
export const endDraft = internalMutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const [league, draft] = await Promise.all([ctx.db.get("leagues", leagueId), draftOf(ctx, leagueId)]);
    const clock = draft?.clock;
    const now = Date.now();
    if (league === null || draft === null || clock?.closing !== true || clock.paused !== undefined || now < clock.startsAt) return null;
    await ctx.db.patch("drafts", draft._id, { clock: undefined });
    for (const drafted of await teamsOf(ctx, leagueId)) await saveFirstLineup(ctx, leagueId, drafted._id);
    if ((await draftRulesNow(ctx, leagueId)).undrafted === "waivers") {
      await ctx.scheduler.runAfter(0, internal.draft.undrafted.putUndraftedOnWaivers, { leagueId, claimableFrom: now });
    }
    const moved = await startAfterDraft(ctx, league, now);
    await tellDraftOver(ctx, league, clock.pick - 1);
    if (moved !== null) await tellScoringStartMoved(ctx, league, moved);
    return null;
  },
});
