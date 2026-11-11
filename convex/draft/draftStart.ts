import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { nextOpenGameweek } from "../lineup/lineups";
import { draftRulesOf } from "../rules/firstRules";
import { historyOf, inForce, latestRules, seasonRules } from "../rules/rulesHistory";
import type { LeagueRules } from "../rules/leagueRulesShape";
import { memberOf, refuse, runnerOf, teamsOf } from "../shared/leagueAccess";
import { closePickTrades, undoCutTrades } from "../trades/tradePicks";
import { startClock } from "./draftClock";
import { tellNotStarted, tellUpNext } from "./draftLetters";
import { DRAFT_FEWEST_TEAMS } from "./draftLimits";
import { draftOrderOf, teamInOrder, teamOrderOf } from "./draftOrder";
import { draftOf, lastPickIn } from "./draftRow";
import { roundsOf } from "./draftRules";
import { pickOnTheClock } from "./snakeOrder";

// Starting the draft (spec/04, Starting it; #1089). It starts on a date the commissioner sets or
// when he presses start; with no date set, it waits for him (Craig, 4 Nov 2026). It runs with the
// teams that exist, at least DRAFT_FEWEST_TEAMS, and only in a league with a squad size limit, as
// its rounds are the squad's most players; a date can't be set without them either, and must be in
// the future. A date that comes when the league can't start stays waiting, as an unset date does
// (Craig, 4 Nov 2026, on #1089). Starting fixes the order: the draft order then (draftOrder.ts),
// and no team can join after (../leagues/teams.ts). It waits until every squad is empty. Its rounds,
// and the squad rules its picks follow, are the league's latest, a change waiting for a later
// gameweek among them: "the squad size is what indicates the draft size" (Craig, 7 Nov 2026, on
// #1130, replacing #1090's "in force when it starts"). Starting closes every pick trade still open
// or in review, unmade (#1096; Craig, 8 Nov 2026), as picks are traded only before it, and undoes
// each pick trade with a pick in a round a squad-size cut removed (#1457; Craig, 11 Nov 2026).

/** Why the draft's start is refused, in the words the commissioner is shown. */
export const draftStartRefusals = {
  started: "The draft has already started.",
  tooFewTeams: `The draft needs at least ${DRAFT_FEWEST_TEAMS} teams in the league.`,
  noSquadSize: "The draft's rounds are the squad's most players, and this league's squads have no size limit.",
  notAhead: "The start has to be in the future.",
  squadsNotEmpty: "The draft can't start until every squad is empty.",
};

/** The league's rules in force at `now`: those of the gameweek under way, or before the league's
 *  first gameweek begins, that gameweek's; a change waiting for a later gameweek isn't among them.
 *  What the draft's pick clock runs by. */
export async function rulesInForceAt(ctx: QueryCtx, leagueId: Id<"leagues">, now: number): Promise<LeagueRules> {
  const [history, season] = await Promise.all([historyOf(ctx, leagueId), seasonRules(ctx, leagueId)]);
  const underWay = (await nextOpenGameweek(ctx, leagueId, season, now)) - 1;
  return inForce(history, Math.max(underWay, history[0].fromGameweek))!.rules;
}

/** Whether any team in the league holds a player. */
async function anyoneHeld(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<boolean> {
  return (await ctx.db.query("squadPlayers").withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId)).first()) !== null;
}

/** Why the league's draft can't start now, or be given a date; otherwise what it starts with: its
 *  teams; its rounds and the squad rules its picks follow, the league's latest, a waiting change's
 *  among them (Craig, 7 Nov 2026, on #1130); and its pick time, the latest's too, so a mid-season
 *  draft starts on the last one typed (Craig, 10 Nov 2026, on #1439: "Last typed"). */
async function startable(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
): Promise<{ refusal: string } | { refusal: null; teams: Doc<"teams">[]; rounds: number; squad: LeagueRules["squad"]; pickSeconds: number }> {
  const teams = await teamsOf(ctx, leagueId);
  if (teams.length < DRAFT_FEWEST_TEAMS) return { refusal: draftStartRefusals.tooFewTeams };
  const latest = await latestRules(ctx, leagueId);
  const rounds = roundsOf(latest);
  if (rounds === null) return { refusal: draftStartRefusals.noSquadSize };
  if (await anyoneHeld(ctx, leagueId)) return { refusal: draftStartRefusals.squadsNotEmpty };
  return { refusal: null, teams, rounds, squad: latest.squad, pickSeconds: draftRulesOf(latest).pickSeconds };
}

/** Writes the draft's date and its scheduled start, or neither for null, cancelling any start
 *  scheduled before. */
async function scheduleStart(ctx: MutationCtx, leagueId: Id<"leagues">, draft: Doc<"drafts"> | null, startsAt: number | null) {
  if (draft?.startJob !== undefined) await ctx.scheduler.cancel(draft.startJob);
  const startJob = startsAt === null ? undefined : await ctx.scheduler.runAt(startsAt, internal.draft.draftStart.startOnDate, { leagueId });
  const fields = { startsAt: startsAt ?? undefined, startJob };
  if (draft === null) await ctx.db.insert("drafts", { leagueId, ...fields });
  else await ctx.db.patch("drafts", draft._id, fields);
}

/** Starts the league's draft now, in the draft order, with the first pick on the clock
 *  (draftClock.ts), unless it has started or can't: then the refusal, with nothing written. */
async function begin(ctx: MutationCtx, league: Doc<"leagues">, draft: Doc<"drafts"> | null): Promise<string | null> {
  if (draft?.started !== undefined) return draftStartRefusals.started;
  const can = await startable(ctx, league._id);
  if (can.refusal !== null) return can.refusal;
  const started = { at: Date.now(), teamIds: draftOrderOf(can.teams, league.draftOrder).map((team) => team._id), rounds: can.rounds, squad: can.squad };
  const pickSeconds = can.pickSeconds;
  if (draft === null) await ctx.db.insert("drafts", { leagueId: league._id, started, pickSeconds });
  else await ctx.db.patch("drafts", draft._id, { started, pickSeconds, startsAt: undefined, startJob: undefined });
  await closePickTrades(ctx, league._id);
  await undoCutTrades(ctx, league, can.rounds);
  const first = await startClock(ctx, league._id, 0, started.at, pickSeconds);
  if (first !== null) await tellUpNext(ctx, league, first);
  return null;
}

/** The commissioner sets the date the draft starts, or clears it with null, so the draft waits for
 *  him to press start. Refused once it has started, for a date not in the future, and for a league
 *  the draft couldn't start in. */
export const setStart = mutation({
  args: { leagueId: v.id("leagues"), startsAt: v.union(v.number(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { leagueId, startsAt }) => {
    await runnerOf(ctx, leagueId);
    const draft = await draftOf(ctx, leagueId);
    if (draft?.started !== undefined) refuse(draftStartRefusals.started);
    if (startsAt !== null) {
      if (startsAt <= Date.now()) refuse(draftStartRefusals.notAhead);
      const can = await startable(ctx, leagueId);
      if (can.refusal !== null) refuse(can.refusal);
    }
    await scheduleStart(ctx, leagueId, draft, startsAt);
    return null;
  },
});

/** The commissioner presses start: the draft starts now, and any date set is cancelled. Refused a
 *  second time, and for a league the draft can't start in. */
export const start = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const { league } = await runnerOf(ctx, leagueId);
    const draft = await draftOf(ctx, leagueId);
    const refusal = await begin(ctx, league, draft);
    if (refusal !== null) refuse(refusal);
    if (draft?.startJob !== undefined) await ctx.scheduler.cancel(draft.startJob);
    return null;
  },
});

/** The start scheduled at the commissioner's date. A league that can't start then, or is being
 *  deleted, stays waiting with its date cleared, as if none had been set (Craig, 4 Nov 2026, on
 *  #1089); a league deleted for good has no draft row left. The commissioner of a league that
 *  can't start gets a letter saying why (Craig, 4 Nov 2026, on #1102). */
export const startOnDate = internalMutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const draft = await draftOf(ctx, leagueId);
    if (draft === null || draft.started !== undefined) return null;
    const league = await ctx.db.get("leagues", leagueId);
    if (league === null || league.deletion !== undefined) {
      await waitWithNoDate(ctx, draft, "the league is being deleted");
      return null;
    }
    const refusal = await begin(ctx, league, draft);
    if (refusal === null) return null;
    await waitWithNoDate(ctx, draft, refusal);
    await tellNotStarted(ctx, league, draft.startsAt ?? Date.now(), refusal);
    return null;
  },
});

/** The draft, which didn't start at its date for `refusal`, clears it and waits for its commissioner. */
async function waitWithNoDate(ctx: MutationCtx, draft: Doc<"drafts">, refusal: string): Promise<void> {
  console.warn(`League ${draft.leagueId}'s draft didn't start at its date, and waits for its commissioner: ${refusal}`);
  await ctx.db.patch("drafts", draft._id, { startsAt: undefined, startJob: undefined });
}

const onTheClock = v.object({ pick: v.number(), round: v.number(), teamId: v.id("teams"), name: v.string() });
/** When the clock of the pick on the clock starts and runs out (draftClock.ts). */
/** A pick's clock: when it starts and runs out, and, while the draft is paused (draftPause.ts),
 *  when it was paused, its time left counted from then. */
const pickClock = v.object({ startsAt: v.number(), endsAt: v.number(), pausedAt: v.optional(v.number()) });
/** The team whose manager made the draft's last pick himself (pickWindow.ts), or null. */
const ownPickBy = v.union(v.id("teams"), v.null());

/** The league's draft as everyone in the league reads it: waiting, with its date (null: until the
 *  commissioner presses start), its rounds (null: the league has no squad size limit) and the
 *  draft order now; live, with when it started, its rounds, its order, fixed at the start, how many
 *  picks are made, the pick on the clock and its clock (null in a draft started before #1091, until
 *  its next pick); ending, for the 10 seconds after its last pick, with when it ends and, while the
 *  commissioner has it paused, when he paused it (pickWindow.ts; #1458); or over, once those are up.
 *  Live or ending, `ownPickBy` is the team whose manager made the last pick himself, which he can
 *  undo until the next clock starts or the draft ends (null: an auto-pick, the commissioner's, or
 *  no pick yet). A waiting draft's rounds are those it would start with now. It takes no minute: one would change its args as the
 *  minute turns and blank the draft room while the new answer loads (#1531). */
export const ofLeague = query({
  args: { leagueId: v.id("leagues") },
  returns: v.union(
    v.object({ status: v.literal("waiting"), startsAt: v.union(v.number(), v.null()), rounds: v.union(v.number(), v.null()), order: v.array(teamInOrder) }),
    v.object({ status: v.literal("live"), startedAt: v.number(), rounds: v.number(), order: v.array(teamInOrder), picksMade: v.number(), onTheClock, clock: v.union(pickClock, v.null()), ownPickBy }),
    v.object({
      status: v.literal("ending"),
      startedAt: v.number(),
      rounds: v.number(),
      order: v.array(teamInOrder),
      picksMade: v.number(),
      endsAt: v.number(),
      pausedAt: v.optional(v.number()),
      ownPickBy,
    }),
    v.object({ status: v.literal("over"), startedAt: v.number(), rounds: v.number(), order: v.array(teamInOrder), picksMade: v.number() }),
  ),
  handler: async (ctx, { leagueId }) => {
    const { league } = await memberOf(ctx, leagueId);
    const [draft, teams] = await Promise.all([draftOf(ctx, leagueId), teamsOf(ctx, leagueId)]);
    if (draft?.started === undefined) {
      const rounds = roundsOf(await latestRules(ctx, leagueId));
      return { status: "waiting" as const, startsAt: draft?.startsAt ?? null, rounds, order: teamOrderOf(teams, league) };
    }
    const { at, teamIds, rounds } = draft.started;
    const names = new Map(teams.map((team) => [team._id, team.name]));
    const order = teamIds.map((teamId) => {
      const name = names.get(teamId);
      if (name === undefined) throw new Error(`League ${leagueId}'s draft names team ${teamId}, which isn't in the league`);
      return { teamId, name };
    });
    const last = await lastPickIn(ctx, leagueId);
    const picksMade = last?.pick ?? 0;
    const turn = pickOnTheClock(teamIds, rounds, picksMade, draft.tradedPicks);
    const started = { startedAt: at, rounds, order, picksMade };
    const ownPickBy = last?.own === undefined ? null : last.teamId;
    if (turn === null && draft.clock?.closing) return { status: "ending" as const, ...started, endsAt: draft.clock.startsAt, pausedAt: draft.clock.paused?.at, ownPickBy };
    if (turn === null) return { status: "over" as const, ...started };
    const clock = draft.clock === undefined ? null : { startsAt: draft.clock.startsAt, endsAt: draft.clock.endsAt, pausedAt: draft.clock.paused?.at };
    // A traded pick's owner is one of the draft's teams, each named in `order` above.
    const { name } = order.find(({ teamId }) => teamId === turn.team)!;
    return { status: "live" as const, ...started, onTheClock: { pick: turn.pick, round: turn.round, teamId: turn.team, name }, clock, ownPickBy };
  },
});
