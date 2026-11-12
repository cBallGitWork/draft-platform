// League rules' tests' shared setup (#25).

import { draftRulesOf, FIRST_RULES } from "../../../convex/rules/firstRules";
import { actingAs, COMMISSIONER, TEST_LEAGUE_TEAMS, type TestConvex } from "./leagues.harness";
import { api } from "../../../convex/_generated/api";
import type { QueryCtx } from "../../../convex/_generated/server";
import { historyOf, seasonRules } from "../../../convex/rules/rulesHistory";
import { squadMaximumFor, STARTING_SQUAD_MAXIMUMS, withSquadMaximum } from "../../../convex/rules/squadMaximums";
import type { LeagueRules } from "../../../convex/rules/leagueRulesShape";
import type { Area } from "../../../convex/lineup/pitch";
import type { Id } from "../../../convex/_generated/dataModel";
import { DAY_MS, MINUTE_MS, WEEK_MS } from "../../../convex/shared/time";
import { FIRST_GAMEWEEK } from "../../../convex/gameweeks/usedGameweeks";
import { PL_GAMEWEEKS } from "./footballRows.harness";

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

/** Every rules row of the league changed by `change`, so the rules in force are, at once: for the
 *  draft's tests, whose rules a save would only change from a later gameweek. */
export const changeEveryRules = (t: TestConvex, leagueId: Id<"leagues">, change: (rules: LeagueRules) => LeagueRules) =>
  t.run(async (ctx) => {
    for (const row of await historyOf(ctx, leagueId)) {
      await ctx.db.patch("leagueRules", row._id, { rules: change(row.rules), changes: undefined });
    }
  });

/** The league's pick clock set to `pickSeconds` at once (changeEveryRules), its other draft rules
 *  kept (#1782), and a started draft's own too, as a change reaching a live draft writes it
 *  (draftPickTime.ts; #1439). */
export async function setPickSeconds(t: TestConvex, leagueId: Id<"leagues">, pickSeconds: number): Promise<void> {
  await changeEveryRules(t, leagueId, (rules) => ({ ...rules, draft: { ...draftRulesOf(rules), pickSeconds } }));
  await t.run(async (ctx) => {
    const draft = await ctx.db.query("drafts").withIndex("by_leagueId", (q) => q.eq("leagueId", leagueId)).unique();
    if (draft?.started !== undefined) await ctx.db.patch("drafts", draft._id, { pickSeconds });
  });
}

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

/** rulesInGameweek, run on the test's deployment. */
export const rulesIn = (t: TestConvex, leagueId: Id<"leagues">, gameweek: number) => t.run((ctx) => rulesInGameweek(ctx, leagueId, gameweek));

/** The league's latest rules as `email` (the commissioner unless a test says) reads them. */
export const latestRules = async (t: TestConvex, leagueId: Id<"leagues">, email = COMMISSIONER) =>
  (await actingAs(t, email)).query(api.rules.leagueRules.latest, { leagueId });

/** The gameweek next to begin in a rules test, so the one a change takes effect from: what it
 *  passes holdGameweeks as `next`. */
export const NEXT = 9;

/** The first rules, played as total points. */
export const TOTAL_POINTS = rulesWith({ format: "totalPoints" });

/** How long from now holdGameweeks' gameweek `next` kicks off, unless a test says. */
export const KICKS_OFF_IN = 6 * DAY_MS;

/** FPL's own deadline, minutes before a gameweek's first kickoff: feed data only, never a league's. */
const FPL_DEADLINE_MINUTES = 90;

/** A season of one match a gameweek, a week apart, gameweek `next` kicking off `kicksOffIn` from
 *  now (KICKS_OFF_IN by default), so every gameweek before it has begun. FPL's deadline, feed data
 *  only, is held 90 minutes before each kickoff, as FPL sets it. */
export async function holdGameweeks(
  t: TestConvex,
  { next, kicksOffIn = KICKS_OFF_IN }: { next: number; kicksOffIn?: number },
): Promise<void> {
  const kickoffOf = (gameweek: number) => Date.now() + kicksOffIn + (gameweek - next) * WEEK_MS;
  await t.run(async (ctx) => {
    for (let number = 1; number <= PL_GAMEWEEKS; number += 1) {
      const kickoff = kickoffOf(number);
      const deadline = kickoff - FPL_DEADLINE_MINUTES * MINUTE_MS;
      await ctx.db.insert("gameweeks", { number, deadline });
      await ctx.db.insert("fixtures", { code: number, gameweek: number, homeClubCode: 1, awayClubCode: 2, kickoff });
    }
  });
}

/** Holds holdGameweeks' one match in the gameweek (coded by its number) at `state`, replacing any
 *  score held for it. */
export const holdMatchState = (t: TestConvex, gameweek: number, state: "live" | "fullTime") =>
  t.run(async (ctx) => {
    const held = await ctx.db.query("matchScores").withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", gameweek)).unique();
    if (held !== null) await ctx.db.delete("matchScores", held._id);
    await ctx.db.insert("matchScores", { fixtureCode: gameweek, state, homeGoals: 1, awayGoals: 0, minutes: 90, clockLabel: null, feed: "fpl", readAt: Date.now() });
  });

/** Holds `extra` current gameweek rows past the tests' season of PL_GAMEWEEKS, with no matches:
 *  each is one more of the season's (#1618), and no read of its schedule may stop on one under
 *  GAMEWEEKS_MOST (#831, #832, #872). */
export const holdGameweeksPastTheSeason = (t: TestConvex, extra: number) =>
  t.run(async (ctx) => {
    for (let number = PL_GAMEWEEKS + 1; number <= PL_GAMEWEEKS + extra; number += 1) await ctx.db.insert("gameweeks", { number, deadline: 0 });
  });

/** Moves FPL's deadline for a gameweek, as its feed might: feed data, so nothing a league decides
 *  may move with it (#138). */
export async function moveFplDeadline(t: TestConvex, gameweek: number, deadline: number): Promise<void> {
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("gameweeks")
      .withIndex("by_season_and_number", (q) => q.eq("season", undefined).eq("number", gameweek))
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
