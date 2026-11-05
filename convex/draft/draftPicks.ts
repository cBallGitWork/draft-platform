import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { areasOf } from "../lineup/pitch";
import { pickFirstLineupAgain } from "../lineup/lineups";
import { fileEvent } from "../mail/letters";
import { positionsNow } from "../positions/playerPositions";
import { draftRulesOf } from "../rules/firstRules";
import type { LeagueRules } from "../rules/leagueRulesShape";
import { managerOf, refuse, refusals, runnerOf, teamIn } from "../shared/leagueAccess";
import { currentClubs, currentPlayersAt, heldPlayerByCode, playerByCode } from "../shared/players";
import { placeOf, squadOf } from "../squads/squadPlace";
import { squadRefusals } from "../squads/squads";
import { autoPickOrder } from "./autoPickOrder";
import { PICK_GAP_MS, startClock } from "./draftClock";
import { tellDraftOver, tellPickedFor, tellUpNext } from "./draftLetters";
import { listsOf } from "./draftLists";
import { draftRanking } from "./draftRanking";
import { draftOf, picksMadeIn, type StartedDraft } from "./draftRow";
import { rulesInForceAt } from "./draftStart";
import { afterTakeBack, afterTimeout, isOnAutoPick, picksAtOnce } from "./draftTimeouts";
import { lastSeasonPoints } from "./lastSeasonPoints";
import { legalPlayers, type DraftPlayer } from "./legalPlayers";
import { pickOnTheClock } from "./snakeOrder";

// Making a pick (spec/04, The picks; #1090). The manager whose team is on the clock picks a player
// it may legally take (legalPlayers.ts, under the squad rules the draft started under), and he joins its
// squad as a commissioner's assignment does: his squad row, the `playerAssigned` event, and the
// team's first lineup picked again; but with no Mail letter, for any pick (Craig, 4 Nov 2026, on
// #1091: "we dont need mail for that and each pick"). The turn moves on by the snake
// (snakeOrder.ts), the next pick's clock starting 10 seconds later (draftClock.ts), its manager
// told he is up next, and once the last pick is made the draft is over (draftStart.ts `ofLeague`),
// which the whole league is told (draftLetters.ts; #1102). When a clock runs out, or at once
// for a team with no manager, the draft picks for the team (`autoPick`; #1091).
// Greying out always leaves a legal pick, so a team with none is an error, not the end of its draft
// (Craig, 4 Nov 2026, on #1090). Auto-pick takes by the team's queue, the admin's ranking and last
// season's points (autoPickOrder.ts; #1094). The commissioner can make the pick for any team on the
// clock (`pickFor`) and undo the last pick (draftCommissioner.ts; #1095). Not built yet: the
// manager's 10-second undo, which will also keep the draft open for the 10 seconds after its last
// pick (Craig, 4 Nov 2026, on #1090): until then it is over at the last pick.

/** Why a pick is refused, in the words the manager is shown. */
export const pickRefusals = {
  notStarted: "The draft hasn't started.",
  over: "The draft is over.",
  paused: "The draft is paused.",
  notYourTurn: (teamName: string) => `It isn't your pick: ${teamName} is on the clock.`,
  taken: (name: string, teamName: string) => `${name} is already on ${teamName}.`,
  breaksSquadRules: (name: string) => `${name} would leave your squad unable to meet the league's squad rules.`,
  notOnAutoPick: "You aren't on auto-pick.",
};

/** The squad rules the draft picks under: those it started under, never a change made since (Craig,
 *  4 Nov 2026, on #1090: "Picks follow the squad rules the draft started under"). A draft started
 *  before #1090 kept none, so its are the league's in force when it started; it always has them, as
 *  it can't start without a squad size limit. */
async function squadRulesOf(ctx: QueryCtx, leagueId: Id<"leagues">, started: StartedDraft): Promise<LeagueRules["squad"]> {
  return started.squad ?? (await startedRulesAt(ctx, leagueId, started.at)).squad;
}

/** The league's rules in force at `at`, which a started draft always has: it can't start without. */
async function startedRulesAt(ctx: QueryCtx, leagueId: Id<"leagues">, at: number): Promise<LeagueRules> {
  const rules = await rulesInForceAt(ctx, leagueId, at);
  if (rules === null) throw new Error(`League ${leagueId}'s draft has started, but the league has no rules`);
  return rules;
}

type Turn = NonNullable<ReturnType<typeof pickOnTheClock<Id<"teams">>>>;

/** Whether the team on the clock may legally take a player, under the squad rules the draft started
 *  under, with the picks it has left counting this one. */
async function legalForTurn(ctx: QueryCtx, leagueId: Id<"leagues">, started: StartedDraft, turn: Turn): Promise<(player: Doc<"players">) => Promise<boolean>> {
  const positionsOf = await positionsNow(ctx, leagueId);
  const squad: DraftPlayer[] = await Promise.all(
    (await squadOf(ctx, turn.team)).map(async ({ playerCode }) => ({
      clubCode: (await heldPlayerByCode(ctx, playerCode, `Player ${playerCode}, drafted by team ${turn.team}, isn't in the football data`)).clubCode,
      areas: areasOf(await positionsOf(playerCode)),
    })),
  );
  // Each team picks once a round, so this round's pick is its (round)th: rounds - round + 1 are left.
  const legal = legalPlayers(squad, started.rounds - turn.round + 1, await squadRulesOf(ctx, leagueId, started));
  return async (player) => legal({ clubCode: player.clubCode, areas: areasOf(await positionsOf(player.code)) });
}

/** The player the manager picks, or the refusal: there is no such player, he has left the Premier
 *  League, or a team in the league already holds him. */
async function pickable(ctx: QueryCtx, leagueId: Id<"leagues">, playerCode: number): Promise<Doc<"players">> {
  const player = (await playerByCode(ctx, playerCode)) ?? refuse(refusals.noPlayer);
  if (player.droppedAt !== undefined) refuse(squadRefusals.playerGone(player.name));
  const place = await placeOf(ctx, leagueId, playerCode);
  if (place !== null) refuse(pickRefusals.taken(player.name, (await teamIn(ctx, leagueId, place.teamId)).name));
  return player;
}

/** The league's draft rules now: a change the commissioner makes reaches the next clock. */
const draftRulesNow = async (ctx: QueryCtx, leagueId: Id<"leagues">) => draftRulesOf(await startedRulesAt(ctx, leagueId, Date.now()));

/** The draft's pick time now, in seconds: the one the commissioner set while it was paused, which
 *  reaches it at once (draftCommissioner.ts; #1095), or else the league's in force now. */
export async function pickSecondsNow(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<number> {
  return (await draftOf(ctx, leagueId))?.pickSeconds ?? (await draftRulesNow(ctx, leagueId)).pickSeconds;
}

/** How a pick was made, besides who by: `timeout` for one the draft made when a managed team's
 *  clock ran out, and `pausedAt` for one the commissioner made while the draft was paused, whose
 *  next clock waits for him to resume. */
type Placed = { timeout?: Doc<"draftPicks">["timeout"]; pausedAt?: number };

/** `player` joins the squad of `team`, on the clock, as its pick, filed as `by`'s, and the next
 *  pick's clock starts PICK_GAP_MS from now, its manager told he is up next; after the last pick,
 *  the whole league is told the draft is over (draftLetters.ts). */
async function placePick(ctx: MutationCtx, league: Doc<"leagues">, turn: Turn, team: Doc<"teams">, player: Doc<"players">, by: string, { timeout, pausedAt }: Placed = {}): Promise<void> {
  const leagueId = league._id;
  const now = Date.now();
  await ctx.db.insert("draftPicks", { leagueId, pick: turn.pick, teamId: team._id, playerCode: player.code, at: now, ...(timeout && { timeout }) });
  await ctx.db.insert("squadPlayers", { leagueId, teamId: team._id, playerCode: player.code });
  await fileEvent(ctx, leagueId, by, { kind: "playerAssigned", playerCode: player.code, playerName: player.name, teamId: team._id, teamName: team.name });
  await pickFirstLineupAgain(ctx, leagueId, team._id);
  const next = await startClock(ctx, leagueId, turn.pick, now + PICK_GAP_MS, await pickSecondsNow(ctx, leagueId), { pausedAt });
  if (next === null) await tellDraftOver(ctx, league, turn.pick);
  else await tellUpNext(ctx, league, next);
}

/** The manager of the team on the clock picks a player, who joins its squad, and the turn moves on.
 *  Refused before the draft starts, once it is over and while it is paused (draftPause.ts), to anyone but the manager on the clock, and
 *  for a player who isn't there to take or would break the team's squad rules. */
export const makePick = mutation({
  args: { leagueId: v.id("leagues"), playerCode: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, playerCode }) => {
    const { email, league, team } = await managerOf(ctx, leagueId);
    const { draft, started, turn } = await liveTurn(ctx, leagueId);
    if (draft.clock?.paused !== undefined) refuse(pickRefusals.paused);
    if (turn.team !== team._id) refuse(pickRefusals.notYourTurn((await teamIn(ctx, leagueId, turn.team)).name));
    const player = await legalPick(ctx, leagueId, started, turn, playerCode);
    if (draft.clock?.job !== undefined) await ctx.scheduler.cancel(draft.clock.job);
    await placePick(ctx, league, turn, team, player, email);
    return null;
  },
});

/** The league's started draft and the pick on its clock, or the refusal: it hasn't started, or it
 *  is over. */
async function liveTurn(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<{ draft: Doc<"drafts">; started: StartedDraft; turn: Turn }> {
  const draft = (await draftOf(ctx, leagueId)) ?? refuse(pickRefusals.notStarted);
  const started = draft.started ?? refuse(pickRefusals.notStarted);
  const turn = pickOnTheClock(started.teamIds, started.rounds, await picksMadeIn(ctx, leagueId)) ?? refuse(pickRefusals.over);
  return { draft, started, turn };
}

/** The player the team on the clock picks, or the refusal: he isn't there to take, or would break
 *  the team's squad rules. */
async function legalPick(ctx: QueryCtx, leagueId: Id<"leagues">, started: StartedDraft, turn: Turn, playerCode: number): Promise<Doc<"players">> {
  const player = await pickable(ctx, leagueId, playerCode);
  if (!(await (await legalForTurn(ctx, leagueId, started, turn))(player))) refuse(pickRefusals.breaksSquadRules(player.name));
  return player;
}

/** The commissioner makes the pick for the team on the clock, any team, with a manager or none, "incase
 *  a manger hops on a flight or something" (Craig, 5 Nov 2026; #1095). It is filed as his, never
 *  counts as that team's timeout, and the whole league is told (draftLetters.ts). While the draft is
 *  paused it stays paused, and the next pick's clock starts when he resumes (Craig, 5 Nov 2026).
 *  Refused to anyone who doesn't run the league, before the draft starts, once it is over, and for a
 *  player who isn't there to take or would break the team's squad rules. */
export const pickFor = mutation({
  args: { leagueId: v.id("leagues"), playerCode: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, playerCode }) => {
    const { email, league } = await runnerOf(ctx, leagueId);
    const { draft, started, turn } = await liveTurn(ctx, leagueId);
    const team = await teamIn(ctx, leagueId, turn.team);
    const player = await legalPick(ctx, leagueId, started, turn, playerCode);
    if (draft.clock?.job !== undefined) await ctx.scheduler.cancel(draft.clock.job);
    await placePick(ctx, league, turn, team, player, email, { pausedAt: draft.clock?.paused === undefined ? undefined : Date.now() });
    await tellPickedFor(ctx, league, email, { pick: turn.pick, playerName: player.name, teamName: team.name });
    return null;
  },
});

/** The player auto-pick takes for the team on the clock: the first in its order (autoPickOrder.ts)
 *  still in the Premier League, held by no team in the league, whom the team may legally take. None
 *  is an error: greying out always leaves a legal pick (#1090). */
async function autoPickFor(ctx: QueryCtx, leagueId: Id<"leagues">, started: StartedDraft, turn: Turn): Promise<Doc<"players">> {
  const legal = await legalForTurn(ctx, leagueId, started, turn);
  const players = (await Promise.all((await currentClubs(ctx)).map(({ code }) => currentPlayersAt(ctx, code)))).flat();
  const lists = await listsOf(ctx, turn.team);
  const order = autoPickOrder(
    players,
    { queue: lists?.queue ?? [], doNotDraft: lists?.doNotDraft ?? [] },
    (await draftRanking(ctx))?.players.map(({ code }) => code) ?? [],
    await lastSeasonPoints(ctx, await positionsNow(ctx, leagueId)),
  );
  const byCode = new Map(players.map((player) => [player.code, player]));
  for (const code of order) {
    const player = byCode.get(code)!;
    if ((await placeOf(ctx, leagueId, code)) === null && (await legal(player))) return player;
  }
  throw new Error(`League ${leagueId}'s pick ${turn.pick} has no legal player left for team ${turn.team}`);
}

/** The draft picks for the team on the clock: when its clock runs out, whether or not its manager is
 *  online (Craig, 4 Nov 2026, on #1091), or as its clock starts for a team with no manager. The
 *  pick is filed as its manager's, or the commissioner's for a team with none. For a team with a
 *  manager it is one of its timeouts, against the league's limit now (draftTimeouts.ts). Does nothing once
 *  `pick` is no longer on the clock: its team picked, or the league is gone. Scheduled at once for a
 *  team that has since gained a manager or taken control back, it waits for the clock's end. */
export const autoPick = internalMutation({
  args: { leagueId: v.id("leagues"), pick: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, pick }) => {
    const [league, draft] = await Promise.all([ctx.db.get("leagues", leagueId), draftOf(ctx, leagueId)]);
    const started = draft?.started;
    if (league === null || started === undefined || draft?.clock?.pick !== pick || draft.clock.paused !== undefined) return null;
    const turn = pickOnTheClock(started.teamIds, started.rounds, await picksMadeIn(ctx, leagueId));
    if (turn?.pick !== pick) return null;
    const team = await teamIn(ctx, leagueId, turn.team);
    if ((!picksAtOnce(draft.timeouts, team) || draft.clock.fullClock) && Date.now() < draft.clock.endsAt) {
      // Scheduled at once, but since then a manager took the team over or took control back, or the
      // commissioner's undo put this pick back on its full clock: the clock runs out first.
      const job = await ctx.scheduler.runAt(draft.clock.endsAt, internal.draft.draftPicks.autoPick, { leagueId, pick });
      await ctx.db.patch("drafts", draft._id, { clock: { ...draft.clock, job } });
      return null;
    }
    const player = await autoPickFor(ctx, leagueId, started, turn);
    let timeout: Placed["timeout"];
    if (team.managerEmail !== undefined) {
      const limit = (await draftRulesNow(ctx, leagueId)).timeoutsBeforeAutoPick;
      const timeouts = afterTimeout(draft.timeouts, team._id, limit);
      timeout = { putOnAutoPick: !isOnAutoPick(draft.timeouts, team._id) && isOnAutoPick(timeouts, team._id) };
      await ctx.db.patch("drafts", draft._id, { timeouts });
    }
    await placePick(ctx, league, turn, team, player, team.managerEmail ?? league.commissionerEmail, { timeout });
    return null;
  },
});

/** A manager on auto-pick takes control back (spec/04, Auto-pick; #1094): his team is off it and
 *  his timeout count is 0 again. A pick of his already on the clock then runs to the clock's end,
 *  not made at once (`autoPick`). Refused to anyone not on auto-pick. */
export const takeControlBack = mutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    const { team } = await managerOf(ctx, leagueId);
    const draft = await draftOf(ctx, leagueId);
    if (draft === null || !isOnAutoPick(draft.timeouts, team._id)) refuse(pickRefusals.notOnAutoPick);
    await ctx.db.patch("drafts", draft._id, { timeouts: afterTakeBack(draft.timeouts, team._id) });
    return null;
  },
});
