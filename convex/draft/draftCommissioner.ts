import { v, type Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import { draftRulesOf } from "../rules/firstRules";
import { changeLatest } from "../rules/leagueRules";
import { historyOf, newestRow } from "../rules/rulesHistory";
import { refuse, runnerOf, teamIn, teamsOf } from "../shared/leagueAccess";
import { startClock } from "./draftClock";
import { tellUndone, tellUpNext } from "./draftLetters";
import { liveClock, pauseRefusals } from "./draftPause";
import { draftIsPaused, pickSecondsNow, pickSecondsOf, pickTimeRefusals } from "./draftPickTime";
import { draftHasStarted, draftIsLive, draftIsOver, draftOf, lastPickIn } from "./draftRow";
import { afterUndoneTimeout } from "./draftTimeouts";
import { takeBackPick } from "./pickWindow";

// The commissioner running the draft (spec/04, The commissioner and Auto-pick; #1095), besides
// pausing it (draftPause.ts) and picking for a team (draftPicks.ts `pickFor`):
// - He undoes the last pick, with no confirm, and again to go further back. The pick put back gets
//   a full clock at the draft's pick time now, starting at once, and the draft makes it for its
//   team only when that clock runs out, even for one it would pick for at once. A pick the draft
//   made when a clock ran out comes off the team's timeouts, and off auto-pick if that timeout put
//   it there. While paused the draft stays paused, the clock starting when he resumes. Once the
//   draft is over there is no undo, and the whole league is told of each (Craig, 4-5 Nov 2026).
// - While the draft is paused he changes its pick time, which reaches the draft at once and
//   League settings too (draftPickTime.ts). Before the start the draft room's box changes League
//   settings' pick time, as changing it there does (Craig, 5 Nov 2026, on #1101).
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
    const { draft, clock } = await liveClock(ctx, leagueId);
    const last = (await lastPickIn(ctx, leagueId)) ?? refuse(commissionerRefusals.noPick);
    const { team, player } = await takeBackPick(ctx, leagueId, last, email);
    if (last.timeout !== undefined) {
      await ctx.db.patch("drafts", draft._id, { timeouts: afterUndoneTimeout(draft.timeouts, team._id, last.timeout) });
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
 *  runs on it from when he resumes, and League settings' pick time changes too. Before the start
 *  it is League settings' pick time alone, as if changed there (Craig, 5 Nov 2026, on #1101).
 *  Refused to anyone who doesn't run the league, while the draft runs unpaused, once it is over,
 *  and for a time outside the league's limits (15 seconds to 24 hours). */
export const setPickTime = mutation({
  args: { leagueId: v.id("leagues"), pickSeconds: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, pickSeconds }) => {
    await runnerOf(ctx, leagueId);
    const live = await draftIsLive(ctx, leagueId);
    if (live && !(await draftIsPaused(ctx, leagueId))) refuse(pickTimeRefusals.notPaused);
    if (await draftIsOver(ctx, leagueId)) refuse(commissionerRefusals.over);
    const revision = (await historyOf(ctx, leagueId)).at(-1)?._id ?? null;
    await changeLatest(ctx, leagueId, revision, (rules) => ({ ...rules, draft: { ...draftRulesOf(rules), pickSeconds } }));
    // League settings may already hold this time, waiting for a gameweek: the draft takes it anyway.
    const draft = await draftOf(ctx, leagueId);
    if (live && draft !== null) await ctx.db.patch("drafts", draft._id, { pickSeconds });
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

const commissionerView = v.object({
  /** The pick time the room's box shows, in seconds: once the draft has started, the draft's own;
   *  before the start, League settings' latest, a change waiting for a gameweek among it; null for
   *  a league with no rules (before #25). */
  pickSeconds: v.union(v.number(), v.null()),
  /** The teams with no manager, by name, each with whether the commissioner picks for it. */
  unmanaged: v.array(v.object({ teamId: v.id("teams"), name: v.string(), marked: v.boolean() })),
});
export type CommissionerView = Infer<typeof commissionerView>;

/** What the draft room's commissioner panel reads (#1101), for whoever runs the league: the pick
 *  time its box shows and the teams with no manager. `now`, the screen's minute, is no longer read
 *  since the box shows the draft's own pick time (#1572); the screen still sends it. */
export const panel = query({
  args: { leagueId: v.id("leagues"), now: v.number() },
  returns: commissionerView,
  handler: async (ctx, { leagueId }) => {
    await runnerOf(ctx, leagueId);
    const [draft, teams, history] = await Promise.all([draftOf(ctx, leagueId), teamsOf(ctx, leagueId), historyOf(ctx, leagueId)]);
    // The draft's pick time once it has started, as its clock runs on (draftPickTime.ts; #1572).
    const started = draft?.started !== undefined ? draft : null;
    const pickSeconds = pickSecondsOf(started, draftRulesOf(newestRow(history, leagueId).rules));
    const unmanaged = teams
      .filter((team) => team.managerEmail === undefined)
      .map((team) => ({ teamId: team._id, name: team.name, marked: team.commissionerPicks === true }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { pickSeconds, unmanaged };
  },
});
