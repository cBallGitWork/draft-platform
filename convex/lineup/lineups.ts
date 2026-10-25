import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { callerEmail, getLeague, refuse, refusals, teamOf } from "../shared/leagueAccess";
import { heldSchedule, seasonRules, type SeasonRules } from "../rules/leagueRules";
import { nextGameweek } from "../gameweeks/nextGameweek";
import { passedDeadlinesOf } from "../gameweeks/passedDeadlines";
import { GAMEWEEKS, isGameweek, noSuchGameweek } from "../gameweeks/usedGameweeks";
import { squadOf } from "../squads/squads";
import { playerByCode } from "../shared/players";
import { currentPositions } from "../positions/playerPositions";
import { howPositionsCount } from "../positions/positionSettings";
import { placementShape } from "../schema";
import { lineupProblems, type Placement } from "./lineup";
import type { Area, Lane } from "./pitch";
import { lineupRefusals, problemWords, unknownPlayerWords } from "./lineupWords";

// Each team's lineup, stored (spec/05, The pitch; #8). A save is a row from the next gameweek
// whose league deadline hasn't passed, and the lineup in a gameweek is the newest row from it or
// before: "a lineup rolls over to the next gameweek if the manager doesn't touch it", with no cron.
// It is read against the squad as it is now: a player who has left drops out, and one who has
// joined sits at the end of the bench. Whether a lineup may stand is lineup.ts's; the screen,
// auto-subs and scoring are not here.

/** A lineup as a manager's browser sends it: lineup.ts's Lineup, its cells still unchecked. */
const sentLineup = v.object({
  starters: v.array(v.object({ playerCode: v.number(), area: v.string(), lane: v.string() })),
  bench: v.array(v.number()),
});

/** A team's lineup in a gameweek: none while it has never saved one (what a team with none plays
 *  at a deadline is not settled), else the newest saved from that gameweek or before, as the squad
 *  now has it. `leftSquad` names who dropped out of it for leaving the squad, `joinedBench` who
 *  joined the squad since and was put at the end of the bench, so a screen can say so. */
export const heldLineupShape = v.union(
  v.object({ kind: v.literal("none") }),
  v.object({
    kind: v.literal("saved"),
    fromGameweek: v.number(),
    starters: v.array(placementShape),
    bench: v.array(v.number()),
    leftSquad: v.array(v.number()),
    joinedBench: v.array(v.number()),
  }),
);
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

/** The team's lineup in the gameweek, as `heldLineupShape` says: for its screen now, and for
 *  auto-subs and scoring once they read it. Positions aren't checked again: a starter who has
 *  lost one since stays in his cell (spec/06, When positions change). */
export async function lineupInGameweek(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  teamId: Id<"teams">,
  gameweek: number,
): Promise<HeldLineup> {
  const row = await rowInForce(ctx, leagueId, teamId, gameweek);
  if (row === null) return { kind: "none" };
  return { kind: "saved", fromGameweek: row.fromGameweek, ...reconciled(row, await squadCodes(ctx, teamId)) };
}

/** The squad's player codes, in the order they joined it. */
async function squadCodes(ctx: QueryCtx, teamId: Id<"teams">): Promise<number[]> {
  return (await squadOf(ctx, teamId)).map(({ playerCode }) => playerCode);
}

/** The saved lineup against the squad now: who has left drops out, leaving his cell empty, and
 *  who has joined goes to the end of the bench, in the order he joined. The bench is the smallest
 *  sound choice for a newcomer (a starter's cell would need a position check and a free cell):
 *  Claude's, not yet Craig's. */
function reconciled(row: Doc<"lineups">, squad: readonly number[]) {
  const inSquad = new Set(squad);
  const named = new Set([...row.starters.map(({ playerCode }) => playerCode), ...row.bench]);
  const joinedBench = squad.filter((playerCode) => !named.has(playerCode));
  return {
    starters: row.starters.filter(({ playerCode }) => inSquad.has(playerCode)),
    bench: [...row.bench.filter((playerCode) => inSquad.has(playerCode)), ...joinedBench],
    leftSquad: [...named].filter((playerCode) => !inSquad.has(playerCode)),
    joinedBench,
  };
}

/** The caller's team in the league, or the refusal: signed out, or running no team there. */
async function ownTeam(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Doc<"teams">> {
  const email = await callerEmail(ctx);
  await getLeague(ctx, leagueId);
  return (await teamOf(ctx, leagueId, email)) ?? refuse(refusals.runsNoTeam);
}

/** The caller's own team's lineup in the gameweek. Whether anyone else may see a team's lineup,
 *  and when, is not settled, so nobody else can yet. */
export const mine = query({
  args: { leagueId: v.id("leagues"), gameweek: v.number() },
  returns: heldLineupShape,
  handler: async (ctx, { leagueId, gameweek }) => {
    const team = await ownTeam(ctx, leagueId);
    if (!isGameweek(gameweek)) refuse(noSuchGameweek(gameweek));
    return await lineupInGameweek(ctx, leagueId, team._id, gameweek);
  },
});

/** The first gameweek whose league deadline, under the rule in force in it, hasn't passed. */
async function nextOpenGameweek(ctx: QueryCtx, leagueId: Id<"leagues">, season: SeasonRules, now: number): Promise<number> {
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
    const team = await ownTeam(ctx, leagueId);
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

    const how = await howPositionsCount(ctx);
    const positions = new Map(
      await Promise.all(lineup.starters.map(async ({ playerCode }) => [playerCode, await currentPositions(ctx, playerCode, how)] as const)),
    );
    const { areaLimits } = season.inGameweek(fromGameweek);
    const problems = lineupProblems(lineup, positions, { areaLimits });
    if (problems.length > 0) refuse(problems.map((problem) => problemWords(problem, nameOf)).join(" "));

    // lineupProblems refused any cell not on the pitch, so every starter's is one.
    const starters = lineup.starters.map((starter: Placement) => ({ ...starter, area: starter.area as Area, lane: starter.lane as Lane }));
    const existing = await ctx.db
      .query("lineups")
      .withIndex("by_leagueId_and_teamId_and_fromGameweek", (q) =>
        q.eq("leagueId", leagueId).eq("teamId", team._id).eq("fromGameweek", fromGameweek),
      )
      .unique();
    if (existing === null) await ctx.db.insert("lineups", { leagueId, teamId: team._id, fromGameweek, starters, bench: lineup.bench });
    else await ctx.db.patch("lineups", existing._id, { starters, bench: lineup.bench });
    return fromGameweek;
  },
});
