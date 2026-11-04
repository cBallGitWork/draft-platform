import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { nextOpenGameweek } from "../lineup/lineups";
import { historyOf, inForce, seasonRules } from "../rules/rulesHistory";
import type { LeagueRules } from "../rules/leagueRulesShape";
import { memberOf, refuse, runnerOf, teamsOf } from "../shared/leagueAccess";
import { DRAFT_FEWEST_TEAMS } from "./draftLimits";
import { draftOrderOf, teamInOrder, teamOrderOf } from "./draftOrder";
import { draftOf, picksMadeIn } from "./draftRow";
import { pickOnTheClock } from "./snakeOrder";

// Starting the draft (spec/04, Starting it; #1089). It starts on a date the commissioner sets or
// when he presses start; with no date set, it waits for him (Craig, 4 Nov 2026). It runs with the
// teams that exist, at least DRAFT_FEWEST_TEAMS, and only in a league with a squad size limit, as
// its rounds are the squad's most players; a date can't be set without them either, and must be in
// the future. A date that comes when the league can't start stays waiting, as an unset date does
// (Craig, 4 Nov 2026, on #1089). Starting fixes the order: the draft order then (draftOrder.ts),
// and no team can join after (../leagues/teams.ts). It waits until every squad is empty, and its
// rounds are the squad maximum in force when it starts, never a change still waiting for a later
// gameweek (Craig, 4 Nov 2026, on #1090).

/** Why the draft's start is refused, in the words the commissioner is shown. */
export const draftStartRefusals = {
  started: "The draft has already started.",
  tooFewTeams: `The draft needs at least ${DRAFT_FEWEST_TEAMS} teams in the league.`,
  noSquadSize: "The draft's rounds are the squad's most players, and this league's squads have no size limit.",
  notAhead: "The start has to be in the future.",
  squadsNotEmpty: "The draft can't start until every squad is empty.",
};

/** The draft's rounds under these rules: the squad's most players, or null with no squad size
 *  limit, or no rules (a league made before #25). */
const roundsOf = (rules: LeagueRules | null): number | null => rules?.squad.size?.maximum ?? null;

/** The league's rules in force at `now`: those of the gameweek under way, or before the league's
 *  first gameweek begins, that gameweek's; a change waiting for a later gameweek isn't among them
 *  (Craig, 4 Nov 2026, on #1090). Null for a league made before #25. What the draft starts and
 *  picks under. */
export async function rulesInForceAt(ctx: QueryCtx, leagueId: Id<"leagues">, now: number): Promise<LeagueRules | null> {
  const [history, season] = await Promise.all([historyOf(ctx, leagueId), seasonRules(ctx, leagueId)]);
  if (season === null || history.length === 0) return null;
  const underWay = (await nextOpenGameweek(ctx, leagueId, season, now)) - 1;
  return inForce(history, Math.max(underWay, history[0].fromGameweek))!.rules;
}

/** Whether any team in the league holds a player. */
async function anyoneHeld(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<boolean> {
  return (await ctx.db.query("squadPlayers").withIndex("by_leagueId_and_playerCode", (q) => q.eq("leagueId", leagueId)).first()) !== null;
}

/** Why the league's draft can't start now, or be given a date; otherwise what it starts with: its
 *  teams, its rounds and the squad rules its picks follow, the league's in force now (Craig, 4 Nov
 *  2026, on #1090: "Picks follow the squad rules the draft started under"). */
async function startable(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
): Promise<{ refusal: string } | { refusal: null; teams: Doc<"teams">[]; rounds: number; squad: LeagueRules["squad"] }> {
  const teams = await teamsOf(ctx, leagueId);
  if (teams.length < DRAFT_FEWEST_TEAMS) return { refusal: draftStartRefusals.tooFewTeams };
  const rules = await rulesInForceAt(ctx, leagueId, Date.now());
  const rounds = roundsOf(rules);
  if (rules === null || rounds === null) return { refusal: draftStartRefusals.noSquadSize };
  if (await anyoneHeld(ctx, leagueId)) return { refusal: draftStartRefusals.squadsNotEmpty };
  return { refusal: null, teams, rounds, squad: rules.squad };
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

/** Starts the league's draft now, in the draft order, unless it has started or can't: then the
 *  refusal, with nothing written. */
async function begin(ctx: MutationCtx, league: Doc<"leagues">, draft: Doc<"drafts"> | null): Promise<string | null> {
  if (draft?.started !== undefined) return draftStartRefusals.started;
  const can = await startable(ctx, league._id);
  if (can.refusal !== null) return can.refusal;
  const started = { at: Date.now(), teamIds: draftOrderOf(can.teams, league.draftOrder).map((team) => team._id), rounds: can.rounds, squad: can.squad };
  if (draft === null) await ctx.db.insert("drafts", { leagueId: league._id, started });
  else await ctx.db.patch("drafts", draft._id, { started, startsAt: undefined, startJob: undefined });
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
 *  #1089); a league deleted for good has no draft row left. */
export const startOnDate = internalMutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const draft = await draftOf(ctx, leagueId);
    if (draft === null || draft.started !== undefined) return null;
    const league = await ctx.db.get("leagues", leagueId);
    const refusal = league === null || league.deletion !== undefined ? "the league is being deleted" : await begin(ctx, league, draft);
    if (refusal !== null) {
      console.warn(`League ${leagueId}'s draft didn't start at its date, and waits for its commissioner: ${refusal}`);
      await ctx.db.patch("drafts", draft._id, { startsAt: undefined, startJob: undefined });
    }
    return null;
  },
});

const onTheClock = v.object({ pick: v.number(), round: v.number(), teamId: v.id("teams"), name: v.string() });

/** The league's draft as everyone in the league reads it: waiting, with its date (null: until the
 *  commissioner presses start), its rounds (null: the league has no squad size limit) and the
 *  draft order now; live, with when it started, its rounds, its order, fixed at the start, how many
 *  picks are made and the pick on the clock; or over, once every pick is made (draftPicks.ts).
 *  A waiting draft's rounds are those it would start with at `now`, the screen's, moved on each
 *  minute, as a query must not read the clock (convex/admin/feeds.ts says why). */
export const ofLeague = query({
  args: { leagueId: v.id("leagues"), now: v.number() },
  returns: v.union(
    v.object({ status: v.literal("waiting"), startsAt: v.union(v.number(), v.null()), rounds: v.union(v.number(), v.null()), order: v.array(teamInOrder) }),
    v.object({ status: v.literal("live"), startedAt: v.number(), rounds: v.number(), order: v.array(teamInOrder), picksMade: v.number(), onTheClock }),
    v.object({ status: v.literal("over"), startedAt: v.number(), rounds: v.number(), order: v.array(teamInOrder), picksMade: v.number() }),
  ),
  handler: async (ctx, { leagueId, now }) => {
    const { league } = await memberOf(ctx, leagueId);
    const [draft, teams] = await Promise.all([draftOf(ctx, leagueId), teamsOf(ctx, leagueId)]);
    if (draft?.started === undefined) {
      const rounds = roundsOf(await rulesInForceAt(ctx, leagueId, now));
      return { status: "waiting" as const, startsAt: draft?.startsAt ?? null, rounds, order: teamOrderOf(teams, league) };
    }
    const { at, teamIds, rounds } = draft.started;
    const names = new Map(teams.map((team) => [team._id, team.name]));
    const order = teamIds.map((teamId) => {
      const name = names.get(teamId);
      if (name === undefined) throw new Error(`League ${leagueId}'s draft names team ${teamId}, which isn't in the league`);
      return { teamId, name };
    });
    const picksMade = await picksMadeIn(ctx, leagueId);
    const turn = pickOnTheClock(order, rounds, picksMade);
    const started = { startedAt: at, rounds, order, picksMade };
    if (turn === null) return { status: "over" as const, ...started };
    return { status: "live" as const, ...started, onTheClock: { pick: turn.pick, round: turn.round, ...turn.team } };
  },
});
