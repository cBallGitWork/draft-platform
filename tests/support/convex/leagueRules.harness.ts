// League rules' tests' shared setup (#25).

import { FPL_DEADLINE_RULE } from "../../../convex/gameweeks/deadline";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { actingAs, COMMISSIONER, TEST_LEAGUE_TEAMS, type TestConvex } from "./leagues.harness";
import { api } from "../../../convex/_generated/api";
import type { QueryCtx } from "../../../convex/_generated/server";
import { seasonRules } from "../../../convex/rules/rulesHistory";
import { squadMaximumFor, STARTING_SQUAD_MAXIMUMS, withSquadMaximum } from "../../../convex/rules/squadMaximums";
import type { LeagueRules } from "../../../convex/rules/leagueRulesShape";
import type { Area } from "../../../convex/lineup/pitch";
import type { Id } from "../../../convex/_generated/dataModel";
import { DAY_MS, MINUTE_MS, WEEK_MS } from "../../../convex/shared/time";
import { FIRST_GAMEWEEK, GAMEWEEKS } from "../../../convex/gameweeks/usedGameweeks";

/** The first rules as a league `adminCreatesLeague` makes holds them: with the starting squad
 *  maximum for its size (#316). */
export const HELD_FIRST_RULES = withSquadMaximum(FIRST_RULES, squadMaximumFor(STARTING_SQUAD_MAXIMUMS, TEST_LEAGUE_TEAMS));

/** A squad's minimum in each area, every one 0: to set a few on (#317). */
export const NO_AREA_MINIMUMS: Record<Area, number> = { goalkeeper: 0, defence: 0, defensiveMidfield: 0, midfield: 0, attackingMidfield: 0, attack: 0 };

/** The first rules as a test league holds them, with some parts changed, as a copy the test may
 *  change further. */
export function rulesWith(change: Partial<LeagueRules>): LeagueRules {
  return structuredClone({ ...HELD_FIRST_RULES, ...change });
}

/** The league's latest rules row, as a screen that loaded them now would carry it to a save; null
 *  for a league with none. */
export const rulesRevision = (t: TestConvex, leagueId: Id<"leagues">) =>
  t.run(async (ctx) => (await ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId)).collect()).at(-1)?._id ?? null);

/** Saves `rules` as the league's, by `by` (the commissioner unless a test says), from the latest
 *  revision read just before, as a screen opened just now saves them. Returns the save's promise,
 *  for a test to await, keep or expect refused. */
export const changeRules = async (t: TestConvex, leagueId: Id<"leagues">, rules: LeagueRules, by = COMMISSIONER) =>
  (await actingAs(t, by)).mutation(api.rules.leagueRules.change, { leagueId, rules, revision: await rulesRevision(t, leagueId) });

/** Rewrites the league's rules rows as rules saved before #33 and #130 made the odd team out and
 *  games a gameweek rules: without them. */
export const savedBeforeTheyWereRules = (t: TestConvex, leagueId: Id<"leagues">) =>
  t.run(async (ctx) => {
    const rows = await ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId)).collect();
    for (const row of rows) {
      const { oddTeamOut: _odd, gamesPerGameweek: _games, ...older } = row.rules;
      await ctx.db.patch("leagueRules", row._id, { rules: older });
    }
  });

/** Sets whether the league plays a gameweek, by `by` (the commissioner unless a test says).
 *  Returns the mutation's promise. */
export const setUsed = async (t: TestConvex, leagueId: Id<"leagues">, gameweek: number, used: boolean, by = COMMISSIONER) =>
  (await actingAs(t, by)).mutation(api.gameweeks.leagueGameweeks.setUsed, { leagueId, gameweek, used });

/** The league's rules in force in a gameweek, read as the table and the lineups read them. Throws
 *  for a league with no rules at all. */
export async function rulesInGameweek(ctx: QueryCtx, leagueId: Id<"leagues">, gameweek: number): Promise<LeagueRules> {
  const season = await seasonRules(ctx, leagueId);
  if (season === null) throw new Error(`League ${leagueId} has no rules`);
  return season.inGameweek(gameweek);
}

/** The first rules, played as total points. */
export const TOTAL_POINTS = rulesWith({ format: "totalPoints" });

/** How long from now holdGameweeks' gameweek `next` kicks off, unless a test says. */
export const KICKS_OFF_IN = 6 * DAY_MS;

/** A season of one match a gameweek, a week apart, gameweek `next` kicking off `kicksOffIn` from
 *  now (KICKS_OFF_IN by default), so every gameweek before it has begun. FPL's deadline, feed data
 *  only, is held 90 minutes before each kickoff, as FPL sets it. */
export async function holdGameweeks(
  t: TestConvex,
  { next, kicksOffIn = KICKS_OFF_IN }: { next: number; kicksOffIn?: number },
): Promise<void> {
  const kickoffOf = (gameweek: number) => Date.now() + kicksOffIn + (gameweek - next) * WEEK_MS;
  await t.run(async (ctx) => {
    for (let number = 1; number <= GAMEWEEKS; number += 1) {
      const kickoff = kickoffOf(number);
      const deadline = kickoff - FPL_DEADLINE_RULE.minutesBeforeFirstKickoff * MINUTE_MS;
      await ctx.db.insert("gameweeks", { number, deadline });
      await ctx.db.insert("fixtures", { code: number, gameweek: number, homeClubCode: 1, awayClubCode: 2, kickoff });
    }
  });
}

/** Holds `extra` current gameweek rows past FPL's 38, with no matches: only a row written by hand
 *  can pass it, and no read of the season's schedule may stop on one (#831, #872). */
export const holdGameweeksPastTheSeason = (t: TestConvex, extra: number) =>
  t.run(async (ctx) => {
    for (let number = GAMEWEEKS + 1; number <= GAMEWEEKS + extra; number += 1) await ctx.db.insert("gameweeks", { number, deadline: 0 });
  });

/** Moves FPL's deadline for a gameweek, as its feed might: feed data, so nothing a league decides
 *  may move with it (#138). */
export async function moveFplDeadline(t: TestConvex, gameweek: number, deadline: number): Promise<void> {
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("gameweeks")
      .withIndex("by_number", (q) => q.eq("number", gameweek))
      .unique();
    await ctx.db.patch("gameweeks", row!._id, { deadline });
  });
}

/** Gives the league a deadline this many minutes before the first kickoff, from `fromGameweek`
 *  (gameweek 1 by default), written straight in: a commissioner's change can only take effect from
 *  the next gameweek, and these tests need it in force now. */
export async function giveDeadlineRule(
  t: TestConvex,
  leagueId: Id<"leagues">,
  minutesBeforeFirstKickoff: number,
  fromGameweek = FIRST_GAMEWEEK,
): Promise<void> {
  const rules = rulesWith({ deadline: { minutesBeforeFirstKickoff } });
  await t.run(async (ctx) => {
    await ctx.db.insert("leagueRules", { leagueId, fromGameweek, rules });
  });
}
