import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isLocked } from "../gameweeks/deadline";
import { GAMEWEEKS, usedGameweeksOf } from "../gameweeks/usedGameweeks";
import { drawRulesOf } from "../rules/firstRules";
import type { LeagueRules } from "../rules/leagueRulesShape";
import { teamsOf } from "../shared/leagueAccess";
import { drawFixtures, type GameweekFixtures } from "./roundRobin";

// A league's head-to-head fixtures, played and to come (#137; spec/13, Gameweeks: "a change
// reshuffles only fixtures not yet played"). The round robin is drawn on each read (roundRobin.ts).
// Once a gameweek begins, at the league's own deadline (never FPL's; deadline.ts), its draw is
// stored in `playedFixtures` and read from there ever after, so nothing that changes later (a team
// joining, a rule, a ticked gameweek, the draw's own code) can move a gameweek already played.
//
// The football sync stores them, beside the passed deadlines it records (deadlineRecorder.ts), and
// a new team is never made without them stored first (teams.ts's putOnTeam), as a team joining is
// the one change that would redraw a gameweek already played. A rule change can't: it takes effect
// from a gameweek not yet begun (leagueRules.ts), and the draw deals each gameweek by the rules in
// force in it (#266). Nor can a ticked or unticked gameweek: only one not yet begun can be, and
// each gameweek's draw hangs only on those before it (roundRobin.ts's roundOrder).

export type Schedule = GameweekFixtures<Id<"teams">>[];

/** All of a league's rules this reads: those in force in each gameweek (leagueRules.ts's
 *  `seasonRules`). */
export type RulesBy = { inGameweek: (gameweek: number) => LeagueRules };

/** The league's stored fixtures, by gameweek: those of each gameweek it has played. */
async function playedFixturesOf(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Map<number, GameweekFixtures<Id<"teams">>>> {
  const rows = await ctx.db
    .query("playedFixtures")
    .withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", leagueId))
    .take(GAMEWEEKS);
  return new Map(rows.map(({ gameweek, fixtures, byes }) => [gameweek, { gameweek, fixtures, byes }]));
}

/** The league's head-to-head fixtures in each gameweek, in order: each gameweek it has played as
 *  stored, and the rest drawn from its teams today, the gameweeks it plays and the rules in force
 *  in each, seeded by the league so a read gives the same draw each time. */
export async function scheduleOf(ctx: QueryCtx, league: Doc<"leagues">, rules: RulesBy): Promise<Schedule> {
  return scheduleAround(ctx, league, rules, await playedFixturesOf(ctx, league._id));
}

/** `scheduleOf`, around the `played` gameweeks already read.
 *
 *  The rest are drawn as if the whole season were drawn now, so while the teams are those the
 *  played gameweeks were drawn with, they carry on the round robin those began. A team joining
 *  mid-season starts a new draw for them instead; whether one can, and how its season then runs,
 *  is for a grill of leagues with splits (docs/to-grill.md), as is the commissioner editing the
 *  fixtures (spec/09). */
async function scheduleAround(ctx: QueryCtx, league: Doc<"leagues">, rules: RulesBy, played: Map<number, GameweekFixtures<Id<"teams">>>): Promise<Schedule> {
  const teamIds = (await teamsOf(ctx, league._id)).map((team) => team._id);
  const drawRulesIn = (gameweek: number) => drawRulesOf(rules.inGameweek(gameweek));
  const drawn = drawFixtures(teamIds, usedGameweeksOf(league), drawRulesIn, league._id);
  const toCome = drawn.filter(({ gameweek }) => !played.has(gameweek));
  return [...played.values(), ...toCome].sort((one, other) => one.gameweek - other.gameweek);
}

/** Stores the fixtures of each gameweek the league has played by `now` and hasn't stored yet, as
 *  they are drawn now: one that began, by its `deadlines` (leagueRules.ts's `leagueDeadlines`),
 *  while the league existed. One that began before the league was made was never played by it, so
 *  it is drawn as before; what a league made mid-season does with those is #282.
 *  Only a gameweek played head-to-head, and only one the draw has: none with fewer than two teams.
 *  A gameweek already stored is left as it is, so storing again does no harm. Returns how many it
 *  stored. Null rules are a league made before #25, which has no fixtures to store. */
export async function storeBegunFixtures(
  ctx: MutationCtx,
  league: Doc<"leagues">,
  rules: RulesBy | null,
  deadlines: ReadonlyMap<number, number | null>,
  now: number,
): Promise<number> {
  if (rules === null) return 0;
  const begunInLeague = (gameweek: number) => {
    const deadline = deadlines.get(gameweek) ?? null;
    return isLocked(deadline, now) && deadline! >= league._creationTime;
  };
  const playedHeadToHead = (gameweek: number) => rules.inGameweek(gameweek).format === "headToHead";
  const played = await playedFixturesOf(ctx, league._id);
  let stored = 0;
  for (const { gameweek, fixtures, byes } of await scheduleAround(ctx, league, rules, played)) {
    if (played.has(gameweek) || !begunInLeague(gameweek) || !playedHeadToHead(gameweek)) continue;
    await ctx.db.insert("playedFixtures", { leagueId: league._id, gameweek, fixtures, byes, storedAt: now });
    stored += 1;
  }
  return stored;
}
