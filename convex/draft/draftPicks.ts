import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { areasOf } from "../lineup/pitch";
import { pickFirstLineupAgain } from "../lineup/lineups";
import { fileEvent } from "../mail/letters";
import { positionsNow, type PositionsNow } from "../positions/playerPositions";
import { knownOnJoining } from "../positions/positionWarnings";
import type { LeagueRules } from "../rules/leagueRulesShape";
import { managerOf, refuse, refusals, runnerOf, teamIn } from "../shared/leagueAccess";
import { heldPlayerByCode, playerByCode } from "../shared/players";
import { placeOf, squadOf } from "../squads/squadPlace";
import { squadRefusals } from "../squads/squads";
import { autoPickOrder } from "./autoPickOrder";
import { autoPickAt, PICK_GAP_MS, picksAtClockStart, scheduleAutoPick, startClock } from "./draftClock";
import { tellPickedFor, tellUpNext } from "./draftLetters";
import { heldListsOf } from "./draftLists";
import { draftRulesNow, pickSecondsNow } from "./draftPickTime";
import { draftRanking } from "./draftRanking";
import type { Position } from "../positions/positionTables";
import { draftedPositionsIn, draftOf, lastPickIn, liveClockOf, picksLeftOf, turnNow, undoWindowOpen, type StartedDraft, type Turn } from "./draftRow";
import { afterTimeout, choseAutoPick, timeoutEffect } from "./draftTimeouts";
import { lastSeasonPoints } from "./lastSeasonPoints";
import { whyNotLegal, type DraftPlayer, type NotLegal } from "./legalPlayers";
import { offWaivers } from "../waivers/waiverPlayers";
import { undraftedIn } from "./undrafted";

// Making a pick (spec/04, The picks; #1090). The manager whose team is on the clock picks a player
// it may legally take (legalPlayers.ts, under the squad rules the draft started under, leaving a
// legal finish from the players still undrafted), and he joins its
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
// clock (`pickFor`) and undo the last pick (draftCommissioner.ts; #1095). A manager can undo his
// own pick for 10 seconds after making it, and nobody picks until they are up; the draft ends only
// after its last pick's 10 seconds (pickWindow.ts; Craig, 4 Nov 2026, on #1090; #1458).

/** Why a pick is refused, in the words the manager is shown. */
export const pickRefusals = {
  notStarted: "The draft hasn't started.",
  over: "The draft is over.",
  paused: "The draft is paused.",
  notYourTurn: (teamName: string) => `It isn't your pick: ${teamName} is on the clock.`,
  alreadyPicked: (teamName: string) => `${teamName} has already picked.`,
  taken: (name: string, teamName: string) => `${name} is already on ${teamName}.`,
  breaksSquadRules: (name: string) => `${name} would leave your squad unable to meet the league's squad rules.`,
  undoing: "The last pick can still be undone: the next clock starts once its 10 seconds are up.",
  allPicked: "Every pick is made: the draft ends in a few seconds.",
  noOwnPick: "You have no pick of your own to undo.",
  undoOver: "Your 10 seconds to undo that pick are up.",
  notOnAutoPick: "You aren't on auto-pick.",
  onAutoPick: "You're already on auto-pick.",
};

/** The squad rules the draft picks under: those it started under, never a change made since (Craig,
 *  4 Nov 2026, on #1090: "Picks follow the squad rules the draft started under"). */
export function squadRulesOf(leagueId: Id<"leagues">, started: StartedDraft): LeagueRules["squad"] {
  if (started.squad === undefined) throw new Error(`League ${leagueId}'s draft kept no squad rules: run draft/oldDraftsBackfill once (#1610)`);
  return started.squad;
}

/** Why `teamId` may not take a player as its next pick, under the squad rules the draft started
 *  under, with `picksLeft` picks still to make counting this one and a legal finish from the
 *  `undrafted`; null when it may, each player's positions read through `positionsOf`. The pick and
 *  the draft room's greyed-out list both ask it. */
export async function whyNotLegalFor(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  started: StartedDraft,
  teamId: Id<"teams">,
  picksLeft: number,
  undrafted: readonly Doc<"players">[],
  positionsOf: PositionsNow,
): Promise<(player: Doc<"players">) => Promise<NotLegal | null>> {
  const asDraftPlayer = async ({ clubCode, code }: Doc<"players">, positions?: Position[]): Promise<DraftPlayer> => ({
    clubCode,
    areas: areasOf(positions ?? (await positionsOf(code))),
  });
  // His squad counts each player it drafted at the positions he had then (#1484).
  const drafted = await draftedPositionsIn(ctx, leagueId);
  const squad = await Promise.all(
    (await squadOf(ctx, teamId)).map(async ({ playerCode }) =>
      asDraftPlayer(await heldPlayerByCode(ctx, playerCode, `Player ${playerCode}, drafted by team ${teamId}, isn't in the football data`), drafted.get(playerCode)),
    ),
  );
  const why = whyNotLegal(squad, picksLeft, squadRulesOf(leagueId, started), await Promise.all(undrafted.map((each) => asDraftPlayer(each))));
  return async (player) => why(await asDraftPlayer(player));
}

/** Whether the team on the clock may legally take a player, under the squad rules the draft started
 *  under, with the picks it has left counting this one and a legal finish from the `undrafted`. */
async function legalForTurn(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  draft: Doc<"drafts">,
  started: StartedDraft,
  turn: Turn,
  undrafted: readonly Doc<"players">[],
  positionsOf: PositionsNow,
): Promise<(player: Doc<"players">) => Promise<boolean>> {
  const why = await whyNotLegalFor(ctx, leagueId, started, turn.team, await picksLeftOf(ctx, draft, started, turn.team), undrafted, positionsOf);
  return async (player) => (await why(player)) === null;
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

/** How a pick was made, besides who by: `auto` for one the draft made, `timeout` for one it made
 *  when a managed team's clock ran out, `pausedAt` for one the commissioner made while the draft was
 *  paused, whose next clock waits for him to resume, and `own` for one its manager made himself,
 *  with the time his clock had left. */
type Placed = { auto?: true; timeout?: Doc<"draftPicks">["timeout"]; pausedAt?: number; own?: Doc<"draftPicks">["own"] };

/** `player` joins the squad of `team`, on the clock, as its pick, filed as `by`'s, and the next
 *  pick's clock starts PICK_GAP_MS from now, its manager told he is up next: after a manager's own
 *  pick only as it starts, when the pick can no longer be undone (Craig, 11 Nov 2026, on #1458).
 *  After the last pick the draft ends PICK_GAP_MS from now (pickWindow.ts `endDraft`). */
async function placePick(ctx: MutationCtx, league: Doc<"leagues">, turn: Turn, team: Doc<"teams">, player: Doc<"players">, by: string, { auto, timeout, pausedAt, own }: Placed = {}): Promise<void> {
  const leagueId = league._id;
  const now = Date.now();
  const positions = await (await positionsNow(ctx, leagueId))(player.code);
  await ctx.db.insert("draftPicks", { leagueId, pick: turn.pick, teamId: team._id, playerCode: player.code, at: now, positions, ...(auto && { auto }), ...(timeout && { timeout }), ...(own && { own }) });
  await ctx.db.insert("squadPlayers", { leagueId, teamId: team._id, playerCode: player.code });
  await knownOnJoining(ctx, leagueId, team._id, player.code);
  await offWaivers(ctx, leagueId, player.code);
  await fileEvent(ctx, leagueId, by, { kind: "playerAssigned", playerCode: player.code, playerName: player.name, teamId: team._id, teamName: team.name });
  await pickFirstLineupAgain(ctx, leagueId, team._id);
  const next = await startClock(ctx, leagueId, turn.pick, now + PICK_GAP_MS, await pickSecondsNow(ctx, leagueId), { pausedAt, ...(own && { upNext: true as const }) });
  if (next !== null && own === undefined) await tellUpNext(ctx, league, next);
}

/** The time `draft`'s clock has left at `now`, for the pick its manager makes then: all of it before
 *  it starts. */
function leftOnTheClock(draft: Doc<"drafts">, now: number): number {
  const clock = liveClockOf(draft);
  return Math.max(0, clock.endsAt - Math.max(now, clock.startsAt));
}

/** The manager of the team on the clock picks a player, who joins its squad, and the turn moves on.
 *  Refused before the draft starts, once every pick is made, while it is paused (draftPause.ts) and
 *  while the last pick can still be undone, to anyone but the manager on the clock, and for a player
 *  who isn't there to take or would break the team's squad rules. */
export const makePick = mutation({
  args: { leagueId: v.id("leagues"), playerCode: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, playerCode }) => {
    const { email, league, team } = await managerOf(ctx, leagueId);
    const { draft, started, turn } = await liveTurn(ctx, leagueId);
    if (draft.clock?.paused !== undefined) refuse(pickRefusals.paused);
    if (turn.team !== team._id) refuse(pickRefusals.notYourTurn((await teamIn(ctx, leagueId, turn.team)).name));
    const now = Date.now();
    if (undoWindowOpen(draft, await lastPickIn(ctx, leagueId), now)) refuse(pickRefusals.undoing);
    const player = await legalPick(ctx, leagueId, draft, started, turn, playerCode);
    const own = { leftMs: leftOnTheClock(draft, now) };
    if (draft.clock?.job !== undefined) await ctx.scheduler.cancel(draft.clock.job);
    await placePick(ctx, league, turn, team, player, email, { own });
    return null;
  },
});

/** The league's started draft and the pick on its clock, or the refusal: it hasn't started, every
 *  pick is made, or it is over. */
async function liveTurn(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<{ draft: Doc<"drafts">; started: StartedDraft; turn: Turn }> {
  const draft = (await draftOf(ctx, leagueId)) ?? refuse(pickRefusals.notStarted);
  const started = draft.started ?? refuse(pickRefusals.notStarted);
  const turn = (await turnNow(ctx, draft)) ?? refuse(draft.clock?.closing ? pickRefusals.allPicked : pickRefusals.over);
  return { draft, started, turn };
}

/** The player the team on the clock picks, or the refusal: he isn't there to take, or would break
 *  the team's squad rules. */
async function legalPick(ctx: QueryCtx, leagueId: Id<"leagues">, draft: Doc<"drafts">, started: StartedDraft, turn: Turn, playerCode: number): Promise<Doc<"players">> {
  const player = await pickable(ctx, leagueId, playerCode);
  const legal = await legalForTurn(ctx, leagueId, draft, started, turn, await undraftedIn(ctx, leagueId), await positionsNow(ctx, leagueId));
  if (!(await legal(player))) refuse(pickRefusals.breaksSquadRules(player.name));
  return player;
}

/** The commissioner makes the pick for the team on the clock, any team, with a manager or none, "incase
 *  a manger hops on a flight or something" (Craig, 5 Nov 2026; #1095). It is filed as his, never
 *  counts as that team's timeout, and the whole league is told (draftLetters.ts). While the draft is
 *  paused it stays paused, and the next pick's clock starts when he resumes (Craig, 5 Nov 2026).
 *  Refused to anyone who doesn't run the league, before the draft starts, once every pick is made,
 *  while a manager can still undo the last pick, for a player who isn't there to take or would
 *  break the team's squad rules, and when the team he picks for is no longer on the clock: it picked, or was picked for, before his pick arrived, so his pick
 *  never lands on the next team (Craig, 11 Nov 2026, on #1477). */
export const pickFor = mutation({
  args: { leagueId: v.id("leagues"), teamId: v.id("teams"), playerCode: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, teamId, playerCode }) => {
    const { email, league } = await runnerOf(ctx, leagueId);
    const { draft, started, turn } = await liveTurn(ctx, leagueId);
    const team = await teamIn(ctx, leagueId, teamId);
    if (turn.team !== team._id) refuse(pickRefusals.alreadyPicked(team.name));
    if (undoWindowOpen(draft, await lastPickIn(ctx, leagueId), Date.now())) refuse(pickRefusals.undoing);
    const player = await legalPick(ctx, leagueId, draft, started, turn, playerCode);
    if (draft.clock?.job !== undefined) await ctx.scheduler.cancel(draft.clock.job);
    await placePick(ctx, league, turn, team, player, email, { pausedAt: draft.clock?.paused === undefined ? undefined : Date.now() });
    await tellPickedFor(ctx, league, email, { pick: turn.pick, playerName: player.name, teamName: team.name });
    return null;
  },
});

/** The player auto-pick takes for the team on the clock: the first in its order (autoPickOrder.ts)
 *  still in the Premier League, held by no team in the league, whom the team may legally take. None
 *  is an error: greying out always leaves a legal pick (#1090). */
async function autoPickFor(ctx: QueryCtx, leagueId: Id<"leagues">, draft: Doc<"drafts">, started: StartedDraft, turn: Turn): Promise<Doc<"players">> {
  const players = await undraftedIn(ctx, leagueId);
  const positionsOf = await positionsNow(ctx, leagueId);
  const legal = await legalForTurn(ctx, leagueId, draft, started, turn, players, positionsOf);
  const order = autoPickOrder(
    players,
    await heldListsOf(ctx, turn.team),
    (await draftRanking(ctx))?.players.map(({ code }) => code) ?? [],
    await lastSeasonPoints(ctx, positionsOf),
  );
  const byCode = new Map(players.map((player) => [player.code, player]));
  for (const code of order) {
    const player = byCode.get(code)!;
    if (await legal(player)) return player;
  }
  throw new Error(`League ${leagueId}'s pick ${turn.pick} has no legal player left for team ${turn.team}`);
}

/** The draft picks for the team on the clock: when its clock runs out, whether or not its manager is
 *  online (Craig, 4 Nov 2026, on #1091), or as its clock starts for a team with no manager. The
 *  pick is filed as its manager's, or the commissioner's for a team with none. For a team with a
 *  manager whose clock ran out it is one of its timeouts, against the league's limit now
 *  (draftTimeouts.ts); one made as its clock starts isn't. Does nothing once
 *  `pick` is no longer on the clock: its team picked, or the league is gone. Scheduled at once for a
 *  team that has since gained a manager or taken control back, it waits for the clock's end. */
export const autoPick = internalMutation({
  args: { leagueId: v.id("leagues"), pick: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, pick }) => {
    const [league, draft] = await Promise.all([ctx.db.get("leagues", leagueId), draftOf(ctx, leagueId)]);
    const started = draft?.started;
    if (league === null || started === undefined || draft?.clock?.pick !== pick || draft.clock.paused !== undefined) return null;
    const turn = await turnNow(ctx, draft);
    if (turn?.pick !== pick) return null;
    const team = await teamIn(ctx, leagueId, turn.team);
    if (Date.now() < autoPickAt(draft, draft.clock, team)) {
      // Scheduled at once, but since then a manager took the team over or took control back, or the
      // commissioner's undo put this pick back on its full clock: the clock runs out first. This job
      // is the clock's own, so the clock goes without it: cancelling it would cancel the new one too.
      await scheduleAutoPick(ctx, draft, { ...draft.clock, job: undefined }, team);
      return null;
    }
    const player = await autoPickFor(ctx, leagueId, draft, started, turn);
    let timeout: Placed["timeout"];
    // Only a clock that ran out is a timeout: a pick made as its clock starts isn't (#1460), and a
    // manager who chose auto-pick keeps his count as it is (Craig, 5 Nov 2026, on #1100).
    if (team.managerEmail !== undefined && !choseAutoPick(draft.timeouts, team._id) && !picksAtClockStart(draft, draft.clock, team)) {
      const limit = (await draftRulesNow(ctx, leagueId)).timeoutsBeforeAutoPick;
      const timeouts = afterTimeout(draft.timeouts, team._id, limit);
      timeout = timeoutEffect(draft.timeouts, timeouts, team._id);
      await ctx.db.patch("drafts", draft._id, { timeouts });
    }
    await placePick(ctx, league, turn, team, player, team.managerEmail ?? league.commissionerEmail, { auto: true, timeout });
    return null;
  },
});
