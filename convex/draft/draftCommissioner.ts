import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { pickFirstLineupAgain } from "../lineup/lineups";
import { fileEvent } from "../mail/letters";
import { draftRulesOf } from "../rules/firstRules";
import { changeLatest } from "../rules/leagueRules";
import { historyOf } from "../rules/rulesHistory";
import { refuse, runnerOf, teamIn } from "../shared/leagueAccess";
import { heldPlayerByCode } from "../shared/players";
import { placeOf } from "../squads/squadPlace";
import { startClock } from "./draftClock";
import { tellUndone, tellUpNext } from "./draftLetters";
import { pauseRefusals } from "./draftPause";
import { pickSecondsNow } from "./draftPicks";
import { draftIsPaused, pickTimeRefusals } from "./draftPickTime";
import { draftHasStarted, draftIsLive, draftOf, lastPickIn } from "./draftRow";
import { afterUndoneTimeout } from "./draftTimeouts";

// The commissioner running the draft (spec/04, The commissioner and Auto-pick; #1095), besides
// pausing it (draftPause.ts) and picking for a team (draftPicks.ts `pickFor`):
// - He undoes the last pick, with no confirm, and again to go further back. The pick put back gets
//   a full clock at the draft's pick time now, starting at once, and the draft makes it for its
//   team only when that clock runs out, even for one it would pick for at once. A pick the draft
//   made when a clock ran out comes off the team's timeouts, and off auto-pick if that timeout put
//   it there. While paused the draft stays paused, the clock starting when he resumes. Once the
//   draft is over there is no undo, and the whole league is told of each (Craig, 4-5 Nov 2026).
// - While the draft is paused he changes its pick time, which reaches the draft at once and
//   League settings too (draftPickTime.ts).
// - Before the draft starts he says "I'll pick for this one" for a team with no manager, and takes
//   it back as often as he likes: its clock then runs, and when it runs out the draft picks for it,
//   with no timeout counted. A manager joining the team takes it off (../leagues/teams.ts).

/** Why the commissioner's undo or "I'll pick for this one" is refused, in the words he is shown. */
export const commissionerRefusals = {
  notStarted: pauseRefusals.notStarted,
  over: pauseRefusals.over,
  noPick: "No pick has been made yet, so there is none to undo.",
  draftStarted: "The draft has started, so who picks for a team can no longer be changed.",
  hasManager: (teamName: string) => `${teamName} has a manager, who picks for it.`,
};

/** The commissioner undoes the last pick: its player leaves the squad, free to pick again, and its
 *  team is back on the clock. Refused to anyone who doesn't run the league, before the draft
 *  starts, before any pick is made and once the draft is over. */
export const undoPick = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const { email, league } = await runnerOf(ctx, leagueId);
    const draft = await draftOf(ctx, leagueId);
    if (draft?.started === undefined) refuse(commissionerRefusals.notStarted);
    if (!(await draftIsLive(ctx, leagueId)) || draft.clock === undefined) refuse(commissionerRefusals.over);
    const { clock } = draft;
    const last = (await lastPickIn(ctx, leagueId)) ?? refuse(commissionerRefusals.noPick);
    const team = await teamIn(ctx, leagueId, last.teamId);
    const player = await heldPlayerByCode(ctx, last.playerCode, `Player ${last.playerCode}, drafted at pick ${last.pick}, isn't in the football data`);
    const place = await placeOf(ctx, leagueId, last.playerCode);
    if (place?.teamId !== last.teamId) throw new Error(`League ${leagueId}'s pick ${last.pick} put player ${last.playerCode} on team ${last.teamId}, but he isn't in its squad`);

    await ctx.db.delete("squadPlayers", place._id);
    await ctx.db.delete("draftPicks", last._id);
    await fileEvent(ctx, leagueId, email, { kind: "playerReleased", playerCode: player.code, playerName: player.name, teamId: team._id, teamName: team.name });
    await pickFirstLineupAgain(ctx, leagueId, team._id);
    if (last.timeout !== undefined) {
      await ctx.db.patch("drafts", draft._id, { timeouts: afterUndoneTimeout(draft.timeouts, team._id, last.timeout.putOnAutoPick) });
    }
    if (clock.job !== undefined) await ctx.scheduler.cancel(clock.job);
    const now = Date.now();
    const pausedAt = clock.paused === undefined ? undefined : now;
    const clocked = await startClock(ctx, leagueId, last.pick - 1, now, await pickSecondsNow(ctx, leagueId), { fullClock: true, pausedAt });
    if (clocked === null) throw new Error(`League ${leagueId}'s pick ${last.pick} was undone, but it can't be put back on the clock`);
    await tellUpNext(ctx, league, clocked);
    await tellUndone(ctx, league, email, { pick: last.pick, playerName: player.name, teamName: team.name });
    return null;
  },
});

/** The commissioner, while the draft is paused, changes its pick time to `pickSeconds`: the draft
 *  runs on it from when he resumes, and League settings' pick time changes too. Refused to anyone
 *  who doesn't run the league, while the draft isn't live and paused, and for a time outside the
 *  league's limits (15 seconds to 24 hours). */
export const setPickTime = mutation({
  args: { leagueId: v.id("leagues"), pickSeconds: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, pickSeconds }) => {
    await runnerOf(ctx, leagueId);
    if (!(await draftIsPaused(ctx, leagueId))) refuse(pickTimeRefusals.notPaused);
    const revision = (await historyOf(ctx, leagueId)).at(-1)?._id ?? null;
    await changeLatest(ctx, leagueId, revision, (rules) => ({ ...rules, draft: { ...draftRulesOf(rules), pickSeconds } }));
    // League settings may already hold this time, waiting for a gameweek: the draft takes it anyway.
    const draft = await draftOf(ctx, leagueId);
    if (draft !== null) await ctx.db.patch("drafts", draft._id, { pickSeconds });
    return null;
  },
});

/** The commissioner says "I'll pick for this one" for a team with no manager, or takes it back with
 *  `marked` false. Refused to anyone who doesn't run the league, once the draft has started, and for
 *  a team with a manager. */
export const markForCommissioner = mutation({
  args: { leagueId: v.id("leagues"), teamId: v.id("teams"), marked: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { leagueId, teamId, marked }) => {
    await runnerOf(ctx, leagueId);
    if (await draftHasStarted(ctx, leagueId)) refuse(commissionerRefusals.draftStarted);
    const team = await teamIn(ctx, leagueId, teamId);
    if (team.managerEmail !== undefined) refuse(commissionerRefusals.hasManager(team.name));
    await ctx.db.patch("teams", teamId, { commissionerPicks: marked ? true : undefined });
    return null;
  },
});
