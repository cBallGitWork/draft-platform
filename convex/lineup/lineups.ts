import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { managerOf, refuse } from "../shared/leagueAccess";
import { seasonRules, type SeasonRules } from "../rules/rulesHistory";
import { heldSchedule, leagueDeadlines, type HeldSchedule } from "../gameweeks/leagueDeadlines";
import { nextGameweek } from "../gameweeks/nextGameweek";
import { fixedDeadlinesOf, passedDeadlineOf } from "../gameweeks/passedDeadlines";
import { seasonGameweekCount } from "../gameweeks/seasonGameweeks";
import { GAMEWEEKS_MOST, lastPlayedGameweek } from "../gameweeks/usedGameweeks";
import { inUnplayedGameweek } from "../waivers/waiverLock";
import { squadAt, squadMovesSince, squadOf, type MovesSinceOf, type SquadMovesSince } from "../squads/squadPlace";
import { lostPlayerName, playerByCode } from "../shared/players";
import { positionsNow } from "../positions/playerPositions";
import { placementShape } from "../schema";
import { lineupProblems, namedCodes, reconciled, withUnmovedSetAside, type PlayerPositions } from "./lineup";
import { firstLineup, keptOnBenchOf, withDroppedRoles } from "./firstLineup";
import { starsOfPlayers } from "../stars/playerStars";
import { heldCell } from "./pitch";
import { roleIn } from "./roles";
import { inClassicFormationShape } from "./classics";
import { classicFormationsOf, instructionsOf } from "../rules/firstRules";
import { lineupRefusals, problemWords } from "./lineupWords";
import { pairRefusal } from "./instructions";
import { instructionPairShape } from "./instructionsShape";
import { pairRefusalWords } from "./instructionsWords";

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
// ends on the whole 4-4-2, or the first preset it fills. Once the manager saves, or the draft ends
// (`saveFirstLineup`; #1040), it is saved, and the squad changes it only as `reconciled` says.

/** A lineup as a manager's browser sends it: lineup.ts's Lineup, its cells still unchecked. */
const sentLineup = v.object({
  starters: v.array(v.object({ playerCode: v.number(), area: v.string(), lane: v.string(), role: v.optional(v.string()) })),
  bench: v.array(v.number()),
  /** The classic formation picked, by name, if its shape is the one the starters stand in (#991):
   *  `classic`, as rows are saved with it (schema/lineup.ts). */
  classic: v.optional(v.string()),
  /** Its two team instructions (#990); absent from a browser that sends none: the formation's
   *  defaults. */
  instructions: v.optional(instructionPairShape),
});

/** A team's lineup in a gameweek: the newest row from that gameweek or before, as the squad has it
 *  (now, or at the deadline once the gameweek has begun). `leftSquad` names who dropped out of it
 *  for leaving the squad, `joinedBench` who joined the squad since and was put at the end of the
 *  bench, so a screen can say so, and `vacated` each starter who left in the slot he left empty,
 *  for auto-subs to fill. `fromGameweek` is null only for a team with no row in force: in a
 *  gameweek begun before #637 stored every team a lineup, or in a league with no rules to date a
 *  row by. It holds its squad on the bench, so such a gameweek stays as it was scored (#1040). */
export const heldLineupShape = v.object({
  fromGameweek: v.union(v.number(), v.null()),
  starters: v.array(placementShape),
  bench: v.array(v.number()),
  leftSquad: v.array(v.number()),
  joinedBench: v.array(v.number()),
  vacated: v.array(placementShape),
  /** The classic formation its manager picked, by name, until he picks another formation (#991). */
  classic: v.optional(v.string()),
  /** The row's team instructions as its manager picked them (#990); absent until he does. What
   *  stands in force is instructions.ts's `keptOrSwitched`, under the league's rules. */
  instructions: v.optional(instructionPairShape),
});
export type HeldLineup = Infer<typeof heldLineupShape>;

/** A lineup no squad change has touched. */
const NO_CHANGES = { leftSquad: [], joinedBench: [], vacated: [] };

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
 *  The league's moves since the deadline are read once for every team, from `movesSinceOf` where a
 *  caller reading many gameweeks shares one read (squadPlace.ts's `squadMovesFrom`; #1542).
 *  Positions aren't checked again: a starter who has lost one since stays in his cell (spec/06,
 *  When positions change). */
export async function lineupsInGameweek(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  teamIds: readonly Id<"teams">[],
  gameweek: number,
  movesSinceOf: MovesSinceOf = (at) => squadMovesSince(ctx, leagueId, at),
): Promise<Map<Id<"teams">, HeldLineup>> {
  const deadline = await passedDeadlineOf(ctx, leagueId, gameweek);
  let movesSince: Promise<SquadMovesSince> | undefined;
  const lineups = new Map<Id<"teams">, HeldLineup>();
  for (const teamId of teamIds) {
    const row = await rowInForce(ctx, leagueId, teamId, gameweek);
    let squad: number[];
    if (deadline === null) squad = await squadCodes(ctx, teamId);
    else {
      movesSince ??= movesSinceOf(deadline);
      squad = await squadAt(ctx, teamId, await movesSince);
    }
    if (row === null) {
      lineups.set(teamId, { fromGameweek: null, starters: [], bench: squad, ...NO_CHANGES });
      continue;
    }
    const { lineup, ...changes } = reconciled(row, squad);
    const { classic, instructions } = row;
    lineups.set(teamId, { fromGameweek: row.fromGameweek, ...lineup, ...changes, ...(classic !== undefined && { classic }), ...(instructions !== undefined && { instructions }) });
  }
  return lineups;
}

/** Each player's positions now in the league (spec/06), for picking a first lineup. */
export async function heldPositionsOf(ctx: QueryCtx, leagueId: Id<"leagues">, playerCodes: readonly number[]): Promise<PlayerPositions> {
  const positionsOfNow = await positionsNow(ctx, leagueId);
  return new Map(await Promise.all(playerCodes.map(async (playerCode) => [playerCode, await positionsOfNow(playerCode)] as const)));
}

/** One team's lineup in the gameweek, as `lineupsInGameweek` gives it. */
export async function lineupInGameweek(ctx: QueryCtx, leagueId: Id<"leagues">, teamId: Id<"teams">, gameweek: number): Promise<HeldLineup> {
  return (await lineupsInGameweek(ctx, leagueId, [teamId], gameweek)).get(teamId)!;
}

/** The squad's player codes, in the order they joined it. */
async function squadCodes(ctx: QueryCtx, teamId: Id<"teams">): Promise<number[]> {
  return (await squadOf(ctx, teamId)).map(({ playerCode }) => playerCode);
}

/** The first gameweek whose league deadline, under the rule in force in it, hasn't passed: the one
 *  a save now is from. A caller asking for many leagues hands in the `schedule` it read once. */
export async function nextOpenGameweek(ctx: QueryCtx, leagueId: Id<"leagues">, season: SeasonRules, now: number, schedule?: HeldSchedule): Promise<number> {
  const { gameweeks, matches } = schedule ?? (await heldSchedule(ctx));
  return nextGameweek(gameweeks, matches, (gameweek) => season.inGameweek(gameweek).deadline, await fixedDeadlinesOf(ctx, leagueId), now);
}

/** The gameweek a save now goes to, or why there is none: once every gameweek the league plays
 *  has begun its season is over, so one that ends early is over after its last (spec/13,
 *  Gameweeks). Each caller says what that means for it. */
export type SaveGameweek =
  | { kind: "seasonOver" }
  | { kind: "open"; season: SeasonRules; gameweek: number };

/** The gameweek a save at `now` goes to (`nextOpenGameweek`), with the league's rules it was
 *  dated by. */
export async function saveGameweekOf(ctx: QueryCtx, leagueId: Id<"leagues">, now: number, schedule?: HeldSchedule): Promise<SaveGameweek> {
  const season = await seasonRules(ctx, leagueId);
  const gameweek = await nextOpenGameweek(ctx, leagueId, season, now, schedule);
  const league = await ctx.db.get("leagues", leagueId);
  if (league === null || gameweek > lastPlayedGameweek(league, await seasonGameweekCount(ctx))) return { kind: "seasonOver" };
  return { kind: "open", season, gameweek };
}

/** Players' names by code, for the refusals. */
async function namesOf(ctx: QueryCtx, playerCodes: Iterable<number>): Promise<Map<number, string>> {
  const names = new Map<number, string>();
  for (const playerCode of playerCodes) {
    names.set(playerCode, (await playerByCode(ctx, playerCode))?.name ?? lostPlayerName(playerCode));
  }
  return names;
}

/** The caller saves their own team's lineup for the next gameweek not yet begun, and it rolls
 *  over from there; a second save before the same deadline replaces the first. Returns that
 *  gameweek. Refused, with every reason, if a player isn't in the squad, a squad player is left
 *  out, or the lineup can't stand under the league's rules in force in that gameweek, short of a
 *  starter who lost a position left where he stood (lineup.ts `withUnmovedSetAside`). */
export const save = mutation({
  args: { leagueId: v.id("leagues"), lineup: sentLineup },
  returns: v.number(),
  handler: async (ctx, { leagueId, lineup }) => {
    const { league, team } = await managerOf(ctx, leagueId);
    const now = Date.now();
    const next = await saveGameweekOf(ctx, leagueId, now);
    if (next.kind === "seasonOver") refuse(lineupRefusals.seasonOver);
    // Lineups are locked through a gameweek the league doesn't play (spec/13, Gameweeks).
    if (await inUnplayedGameweek(ctx, league, await leagueDeadlines(ctx, leagueId), now)) refuse(lineupRefusals.unplayedGameweek);
    const { season, gameweek: fromGameweek } = next;

    const squad = await squadCodes(ctx, team._id);
    const named = namedCodes(lineup);
    const names = await namesOf(ctx, new Set([...squad, ...named]));
    const nameOf = (playerCode: number) => names.get(playerCode) ?? lostPlayerName(playerCode);
    const outsiders = [...new Set(named.filter((playerCode) => !squad.includes(playerCode)))];
    if (outsiders.length > 0) refuse(lineupRefusals.notInSquad(outsiders.map(nameOf)));
    const leftOut = squad.filter((playerCode) => !named.includes(playerCode));
    if (leftOut.length > 0) refuse(lineupRefusals.leftOut(leftOut.map(nameOf)));

    const positions = await heldPositionsOf(ctx, leagueId, lineup.starters.map(({ playerCode }) => playerCode));
    const rules = season.inGameweek(fromGameweek);
    const existing = await rowInForce(ctx, leagueId, team._id, fromGameweek);
    // A starter who lost a position and is left where he stood doesn't stop the rest saving (#1589).
    const { problems, kept: keptOutOfPosition } = withUnmovedSetAside(lineupProblems(lineup, positions, rules), lineup.starters, existing, fromGameweek);
    if (problems.length > 0) refuse(problems.map((problem) => problemWords(problem, nameOf)).join(" "));
    // lineupProblems refused any cell not on the pitch, so every starter's is one.
    const cells = lineup.starters.map(heldCell);
    const set = instructionsOf(rules);
    const refusal = lineup.instructions === undefined ? null : pairRefusal(lineup.instructions, cells, set);
    if (refusal !== null) refuse(pairRefusalWords(refusal, set));
    // None sent is none picked: the row reads the formation's defaults (tactics.ts).
    const { instructions } = lineup;

    // lineupProblems refused any role another slot offers; a role removed from the set is saved as
    // the one he plays (#841).
    const starters = lineup.starters.map(({ role, ...starter }, index) => {
      const cell = cells[index];
      return { ...starter, ...cell, ...(role === undefined ? {} : { role: roleIn(cell, role).key }) };
    });
    // A classic formation's shape never changes (spec/05; #991): its starters stand in its cells.
    const { classic: classicFormation } = lineup;
    if (classicFormation !== undefined) {
      const held = classicFormationsOf(rules).find(({ name }) => name === classicFormation);
      if (held === undefined) refuse(lineupRefusals.noSuchClassicFormation(classicFormation));
      if (!inClassicFormationShape(starters, held)) refuse(lineupRefusals.notInClassicFormationShape(classicFormation));
    }
    // The manager's own from here: no squad change picks it again.
    const kept = { starters, bench: lineup.bench, classic: classicFormation, instructions, keptOutOfPosition: keptOutOfPosition.length > 0 ? keptOutOfPosition : undefined };
    if (existing?.fromGameweek !== fromGameweek) await ctx.db.insert("lineups", { leagueId, teamId: team._id, fromGameweek, ...kept });
    else await ctx.db.patch("lineups", existing._id, { ...kept, firstLineup: undefined });
    return fromGameweek;
  },
});

/** After a change to the team's squad: while its lineup is still its first, the first lineup is
 *  picked again from the squad as it is now, under the rules in force then, from the next gameweek
 *  not yet begun, so a gameweek begun keeps the one it locked. A player it benched for having no
 *  positions stays on the bench once he has some (firstLineup.ts `keptOnBenchOf`). A lineup the
 *  manager saved is left to `reconciled`. Nothing is written for a league with no rules, whose
 *  gameweeks can't be dated, or once the season is over. */
export async function pickFirstLineupAgain(ctx: MutationCtx, leagueId: Id<"leagues">, teamId: Id<"teams">): Promise<void> {
  const next = await saveGameweekOf(ctx, leagueId, Date.now());
  if (next.kind !== "open") return;
  const { season, gameweek: fromGameweek } = next;
  const row = await rowInForce(ctx, leagueId, teamId, fromGameweek);
  if (row !== null && row.firstLineup !== true) return;
  const squad = await squadCodes(ctx, teamId);
  const positions = await heldPositionsOf(ctx, leagueId, squad);
  const keptOnBench = row === null ? new Set<number>() : keptOnBenchOf(row, squad, positions);
  const stars = await starsOfPlayers(ctx, squad);
  const picked = withDroppedRoles(firstLineup(squad, positions, season.inGameweek(fromGameweek), keptOnBench), (playerCode) => stars.get(playerCode)!, positions, row?.starters);
  if (row?.fromGameweek === fromGameweek) await ctx.db.patch("lineups", row._id, picked);
  else await ctx.db.insert("lineups", { leagueId, teamId, fromGameweek, ...picked, firstLineup: true });
}

/** The auto team's lineup for a gameweek begun (autoTeam.ts; spec/09): a saved row from it, which
 *  rolls over as the manager's would, replacing one from that gameweek if there is one. */
export async function storeAutoTeamLineup(
  ctx: MutationCtx,
  leagueId: Id<"leagues">,
  teamId: Id<"teams">,
  fromGameweek: number,
  lineup: Pick<Doc<"lineups">, "starters" | "bench">,
): Promise<void> {
  const existing = await rowInForce(ctx, leagueId, teamId, fromGameweek);
  if (existing?.fromGameweek === fromGameweek) await ctx.db.patch("lineups", existing._id, { ...lineup, firstLineup: undefined, classic: undefined });
  // A new row carries the team's instructions on: the auto team only ever touches the lineup (spec/09).
  else await ctx.db.insert("lineups", { leagueId, teamId, fromGameweek, ...lineup, instructions: existing?.instructions });
}

/** When the draft ends (#1040): the team's first lineup, as its picks left it, becomes its saved
 *  lineup, so no later squad change, nor a change to how a first lineup is picked, picks it
 *  again. Returns whether it held a first lineup to save. */
export async function saveFirstLineup(ctx: MutationCtx, leagueId: Id<"leagues">, teamId: Id<"teams">): Promise<boolean> {
  const rows = await ctx.db
    .query("lineups")
    .withIndex("by_leagueId_and_teamId_and_fromGameweek", (q) => q.eq("leagueId", leagueId).eq("teamId", teamId))
    // One row a gameweek at most (`save`).
    .take(GAMEWEEKS_MOST);
  const first = rows.filter((row) => row.firstLineup === true);
  for (const row of first) await ctx.db.patch("lineups", row._id, { firstLineup: undefined });
  return first.length > 0;
}
