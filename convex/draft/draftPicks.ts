import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, type QueryCtx } from "../_generated/server";
import { areasOf } from "../lineup/pitch";
import { pickFirstLineupAgain } from "../lineup/lineups";
import { recordEvent } from "../mail/letters";
import { positionsNow, type PositionsNow } from "../positions/playerPositions";
import type { LeagueRules } from "../rules/leagueRulesShape";
import { managerOf, refuse, refusals, teamIn } from "../shared/leagueAccess";
import { heldPlayerByCode, playerByCode } from "../shared/players";
import { placeOf, squadOf } from "../squads/squadPlace";
import { squadRefusals } from "../squads/squads";
import { draftOf, picksMadeIn, type StartedDraft } from "./draftRow";
import { rulesInForceAt } from "./draftStart";
import { legalPlayers, type DraftPlayer } from "./legalPlayers";
import { pickOnTheClock } from "./snakeOrder";

// Making a pick (spec/04, The picks; #1090). The manager whose team is on the clock picks a player
// it may legally take (legalPlayers.ts, under the squad rules the draft started under), and he joins its
// squad as a commissioner's assignment does: his squad row, the `playerAssigned` event and its
// Mail letter, and the team's first lineup picked again. The turn moves on by the snake
// (snakeOrder.ts), and once the last pick is made the draft is over (draftStart.ts `ofLeague`).
// Greying out always leaves a legal pick, so a team with none is an error, not the end of its draft
// (Craig, 4 Nov 2026, on #1090). Not built yet: the clock, auto-pick, the commissioner's picks and
// undo, and the manager's 10-second undo, which will also keep the draft open for the 10 seconds
// after its last pick (Craig, 4 Nov 2026, on #1090): until then it is over at the last pick.

/** Why a pick is refused, in the words the manager is shown. */
export const pickRefusals = {
  notStarted: "The draft hasn't started.",
  over: "The draft is over.",
  notYourTurn: (teamName: string) => `It isn't your pick: ${teamName} is on the clock.`,
  taken: (name: string, teamName: string) => `${name} is already on ${teamName}.`,
  breaksSquadRules: (name: string) => `${name} would leave your squad unable to meet the league's squad rules.`,
};

/** The team's squad as legalPlayers.ts reads it: each player's club and areas now. */
async function draftSquadOf(ctx: QueryCtx, teamId: Id<"teams">, positionsOf: PositionsNow): Promise<DraftPlayer[]> {
  return Promise.all(
    (await squadOf(ctx, teamId)).map(async ({ playerCode }) => ({
      clubCode: (await heldPlayerByCode(ctx, playerCode, `Player ${playerCode}, drafted by team ${teamId}, isn't in the football data`)).clubCode,
      areas: areasOf(await positionsOf(playerCode)),
    })),
  );
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

/** The squad rules the draft picks under: those it started under, never a change made since (Craig,
 *  4 Nov 2026, on #1090: "Picks follow the squad rules the draft started under"). A draft started
 *  before #1090 kept none, so its are the league's in force when it started; it always has them, as
 *  it can't start without a squad size limit. */
async function squadRulesOf(ctx: QueryCtx, leagueId: Id<"leagues">, started: StartedDraft): Promise<LeagueRules["squad"]> {
  if (started.squad !== undefined) return started.squad;
  const rules = await rulesInForceAt(ctx, leagueId, started.at);
  if (rules === null) throw new Error(`League ${leagueId}'s draft has started, but the league has no rules`);
  return rules.squad;
}

/** The manager of the team on the clock picks a player, who joins its squad, and the turn moves on.
 *  Refused before the draft starts and once it is over, to anyone but the manager on the clock, and
 *  for a player who isn't there to take or would break the team's squad rules. */
export const makePick = mutation({
  args: { leagueId: v.id("leagues"), playerCode: v.number() },
  returns: v.null(),
  handler: async (ctx, { leagueId, playerCode }) => {
    const { email, team } = await managerOf(ctx, leagueId);
    const started = (await draftOf(ctx, leagueId))?.started ?? refuse(pickRefusals.notStarted);
    const picksMade = await picksMadeIn(ctx, leagueId);
    const turn = pickOnTheClock(started.teamIds, started.rounds, picksMade) ?? refuse(pickRefusals.over);
    if (turn.team !== team._id) refuse(pickRefusals.notYourTurn((await teamIn(ctx, leagueId, turn.team)).name));
    const player = await pickable(ctx, leagueId, playerCode);
    const positionsOf = await positionsNow(ctx, leagueId);
    const squad = await draftSquadOf(ctx, team._id, positionsOf);
    // Each team picks once a round, so this round's pick is its (round)th: rounds - round + 1 are left.
    const legal = legalPlayers(squad, started.rounds - turn.round + 1, await squadRulesOf(ctx, leagueId, started));
    if (!legal({ clubCode: player.clubCode, areas: areasOf(await positionsOf(playerCode)) })) refuse(pickRefusals.breaksSquadRules(player.name));
    await ctx.db.insert("draftPicks", { leagueId, pick: turn.pick, teamId: team._id, playerCode, at: Date.now() });
    await ctx.db.insert("squadPlayers", { leagueId, teamId: team._id, playerCode });
    await recordEvent(ctx, leagueId, email, { kind: "playerAssigned", playerCode, playerName: player.name, teamId: team._id, teamName: team.name });
    await pickFirstLineupAgain(ctx, leagueId, team._id);
    return null;
  },
});
