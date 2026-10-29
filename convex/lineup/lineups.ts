import { v, type Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { managerOf, refuse } from "../shared/leagueAccess";
import { seasonRules, type SeasonRules } from "../rules/rulesHistory";
import { heldSchedule } from "../gameweeks/leagueDeadlines";
import { nextGameweek } from "../gameweeks/nextGameweek";
import { passedDeadlineOf, passedDeadlinesOf } from "../gameweeks/passedDeadlines";
import { GAMEWEEKS, isGameweek, noSuchGameweek } from "../gameweeks/usedGameweeks";
import { squadAt, squadMovesSince, squadOf, type SquadMovesSince } from "../squads/squads";
import { playerByCode } from "../shared/players";
import { currentPositions } from "../positions/playerPositions";
import { howPositionsCount } from "../positions/positionSettings";
import { placementShape } from "../schema";
import { lineupProblems, reconciled, type PlayerPositions } from "./lineup";
import { firstLineup } from "./firstLineup";
import type { Area, Lane } from "./pitch";
import { lineupRefusals, problemWords, unknownPlayerWords } from "./lineupWords";

// Each team's lineup, stored (spec/05, The pitch; #8). A save is a row from the next gameweek
// whose league deadline hasn't passed, and the lineup in a gameweek is the newest row from it or
// before: "a lineup rolls over to the next gameweek if the manager doesn't touch it", with no cron.
// It is read against the squad: as it is now for a gameweek not yet begun, and as it stood at the
// deadline for one begun, so a move after the lock never reaches a locked lineup (spec/05, The
// deadline: "it locks the whole lineup"; #415), by lineup.ts's `reconciled`, which the Tactics
// screen reads an edit by too. Whether a lineup may stand is lineup.ts's; the screen,
// auto-subs and scoring are not here.
//
// A team always has a lineup (spec/05, spec/07; #637): "you don't save to create, you save to
// edit". Until its manager saves one, its row is its first lineup (firstLineup.ts), marked so and
// picked again from the squad each time the squad changes, so a squad built one player at a time
// ends on the whole 4-4-2. Once the manager saves, it is his, and the squad changes it only as
// `reconciled` says.

/** A lineup as a manager's browser sends it: lineup.ts's Lineup, its cells still unchecked. */
const sentLineup = v.object({
  starters: v.array(v.object({ playerCode: v.number(), area: v.string(), lane: v.string(), role: v.optional(v.string()) })),
  bench: v.array(v.number()),
});

/** A team's lineup in a gameweek: the newest row from that gameweek or before, as the squad has it
 *  (now, or at the deadline once the gameweek has begun). `leftSquad` names who dropped out of it
 *  for leaving the squad, `joinedBench` who joined the squad since and was put at the end of the
 *  bench, so a screen can say so, and `vacated` each starter who left in the slot he left empty,
 *  for auto-subs to fill. `fromGameweek` is null for a team with no row in force: one whose players
 *  joined before teams held a first lineup, or a league with no rules to date a row by. Before the
 *  deadline it holds its first lineup; once begun, its squad as it stood, all on the bench, so a
 *  gameweek scored before #637 stays as it was scored. */
export const heldLineupShape = v.object({
  fromGameweek: v.union(v.number(), v.null()),
  starters: v.array(placementShape),
  bench: v.array(v.number()),
  leftSquad: v.array(v.number()),
  joinedBench: v.array(v.number()),
  vacated: v.array(placementShape),
});
export type HeldLineup = Infer<typeof heldLineupShape>;

/** The row in force in the gameweek: the latest from it or before. One row a gameweek at most
 *  (`save` replaces a second), so the index's last match is it. */
function rowInForce(ctx: QueryCtx, leagueId: Id<"leagues">, teamId: Id<"teams">, gameweek: number) {
  return ctx.db
    .query("lineups")
    .withIndex("by_leagueId_and_teamId_and_fromGameweek", (q) =>
      q.eq("leagueId", leagueId).eq("teamId", teamId).lte("fromGameweek", gameweek),
    )
    .order("desc")
    .first();
}

/** Each team's lineup in the gameweek, as `heldLineupShape` says: for its screen, auto-subs and
 *  scoring. Begun means its deadline is recorded (deadlineRecorder.ts), as it passes; until it is
 *  recorded, the squad now is read, and a move made in between leaves the lineup once it does.
 *  The league's moves since the deadline are read once for every team. Positions aren't checked
 *  again: a starter who has lost one since stays in his cell (spec/06, When positions change). */
export async function lineupsInGameweek(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  teamIds: readonly Id<"teams">[],
  gameweek: number,
): Promise<Map<Id<"teams">, HeldLineup>> {
  const deadline = await passedDeadlineOf(ctx, leagueId, gameweek);
  let movesSince: Promise<SquadMovesSince> | undefined;
  const lineups = new Map<Id<"teams">, HeldLineup>();
  for (const teamId of teamIds) {
    const row = await rowInForce(ctx, leagueId, teamId, gameweek);
    let squad: number[];
    if (deadline === null) squad = await squadCodes(ctx, teamId);
    else {
      movesSince ??= squadMovesSince(ctx, leagueId, deadline);
      squad = await squadAt(ctx, teamId, await movesSince);
    }
    if (row === null) {
      const held = deadline === null ? firstLineup(squad, await positionsOf(ctx, squad)) : { starters: [], bench: squad };
      lineups.set(teamId, { fromGameweek: null, ...held, ...NO_CHANGES });
      continue;
    }
    const { lineup, ...changes } = reconciled(row, squad);
    lineups.set(teamId, { fromGameweek: row.fromGameweek, ...lineup, ...changes });
  }
  return lineups;
}

/** A lineup no squad change has touched. */
const NO_CHANGES = { leftSquad: [], joinedBench: [], vacated: [] };

/** Each player's positions now (spec/06), for picking a first lineup. */
async function positionsOf(ctx: QueryCtx, playerCodes: readonly number[]): Promise<PlayerPositions> {
  const how = await howPositionsCount(ctx);
  return new Map(await Promise.all(playerCodes.map(async (playerCode) => [playerCode, await currentPositions(ctx, playerCode, how)] as const)));
}

/** One team's lineup in the gameweek, as `lineupsInGameweek` gives it. */
export async function lineupInGameweek(ctx: QueryCtx, leagueId: Id<"leagues">, teamId: Id<"teams">, gameweek: number): Promise<HeldLineup> {
  return (await lineupsInGameweek(ctx, leagueId, [teamId], gameweek)).get(teamId)!;
}

/** The squad's player codes, in the order they joined it. */
async function squadCodes(ctx: QueryCtx, teamId: Id<"teams">): Promise<number[]> {
  return (await squadOf(ctx, teamId)).map(({ playerCode }) => playerCode);
}

/** The caller's own team's lineup in the gameweek. Whether anyone else may see a team's lineup,
 *  and when, is not settled, so nobody else can yet. */
export const mine = query({
  args: { leagueId: v.id("leagues"), gameweek: v.number() },
  returns: heldLineupShape,
  handler: async (ctx, { leagueId, gameweek }) => {
    const { team } = await managerOf(ctx, leagueId);
    if (!isGameweek(gameweek)) refuse(noSuchGameweek(gameweek));
    return await lineupInGameweek(ctx, leagueId, team._id, gameweek);
  },
});

/** The first gameweek whose league deadline, under the rule in force in it, hasn't passed: the one
 *  a save now is from. */
export async function nextOpenGameweek(ctx: QueryCtx, leagueId: Id<"leagues">, season: SeasonRules, now: number): Promise<number> {
  const { gameweeks, matches } = await heldSchedule(ctx);
  return nextGameweek(gameweeks, matches, (gameweek) => season.inGameweek(gameweek).deadline, await passedDeadlinesOf(ctx, leagueId), now);
}

/** Players' names by code, for the refusals. */
async function namesOf(ctx: QueryCtx, playerCodes: Iterable<number>): Promise<Map<number, string>> {
  const names = new Map<number, string>();
  for (const playerCode of playerCodes) {
    names.set(playerCode, (await playerByCode(ctx, playerCode))?.name ?? unknownPlayerWords(playerCode));
  }
  return names;
}

/** The caller saves their own team's lineup for the next gameweek not yet begun, and it rolls
 *  over from there; a second save before the same deadline replaces the first. Returns that
 *  gameweek. Refused, with every reason, if a player isn't in the squad, a squad player is left
 *  out, or the lineup can't stand under the league's rules in force in that gameweek. */
export const save = mutation({
  args: { leagueId: v.id("leagues"), lineup: sentLineup },
  returns: v.number(),
  handler: async (ctx, { leagueId, lineup }) => {
    const { team } = await managerOf(ctx, leagueId);
    const season = (await seasonRules(ctx, leagueId)) ?? refuse(lineupRefusals.noRules);
    const fromGameweek = await nextOpenGameweek(ctx, leagueId, season, Date.now());
    if (fromGameweek > GAMEWEEKS) refuse(lineupRefusals.seasonOver);

    const squad = await squadCodes(ctx, team._id);
    const named = [...lineup.starters.map(({ playerCode }) => playerCode), ...lineup.bench];
    const names = await namesOf(ctx, new Set([...squad, ...named]));
    const nameOf = (playerCode: number) => names.get(playerCode) ?? unknownPlayerWords(playerCode);
    const outsiders = [...new Set(named.filter((playerCode) => !squad.includes(playerCode)))];
    if (outsiders.length > 0) refuse(lineupRefusals.notInSquad(outsiders.map(nameOf)));
    const leftOut = squad.filter((playerCode) => !named.includes(playerCode));
    if (leftOut.length > 0) refuse(lineupRefusals.leftOut(leftOut.map(nameOf)));

    const positions = await positionsOf(ctx, lineup.starters.map(({ playerCode }) => playerCode));
    const { areaLimits } = season.inGameweek(fromGameweek);
    const problems = lineupProblems(lineup, positions, { areaLimits });
    if (problems.length > 0) refuse(problems.map((problem) => problemWords(problem, nameOf)).join(" "));

    // lineupProblems refused any cell not on the pitch, so every starter's is one.
    const starters = lineup.starters.map((starter) => ({ ...starter, area: starter.area as Area, lane: starter.lane as Lane }));
    const existing = await rowInForce(ctx, leagueId, team._id, fromGameweek);
    // The manager's own from here: no squad change picks it again.
    if (existing?.fromGameweek !== fromGameweek) await ctx.db.insert("lineups", { leagueId, teamId: team._id, fromGameweek, starters, bench: lineup.bench });
    else await ctx.db.patch("lineups", existing._id, { starters, bench: lineup.bench, firstLineup: undefined });
    return fromGameweek;
  },
});

/** After a change to the team's squad: while its lineup is still its first, the first lineup is
 *  picked again from the squad as it is now, from the next gameweek not yet begun, so a gameweek
 *  begun keeps the one it locked. A lineup the manager saved is left to `reconciled`. Nothing is
 *  written for a league with no rules, whose gameweeks can't be dated, or once the season is over. */
export async function pickFirstLineupAgain(ctx: MutationCtx, leagueId: Id<"leagues">, teamId: Id<"teams">): Promise<void> {
  const season = await seasonRules(ctx, leagueId);
  if (season === null) return;
  const fromGameweek = await nextOpenGameweek(ctx, leagueId, season, Date.now());
  if (fromGameweek > GAMEWEEKS) return;
  const row = await rowInForce(ctx, leagueId, teamId, fromGameweek);
  if (row !== null && row.firstLineup !== true) return;
  const squad = await squadCodes(ctx, teamId);
  const picked = firstLineup(squad, await positionsOf(ctx, squad));
  if (row?.fromGameweek === fromGameweek) await ctx.db.patch("lineups", row._id, picked);
  else await ctx.db.insert("lineups", { leagueId, teamId, fromGameweek, ...picked, firstLineup: true });
}
