// League rules' tests' shared setup (#25).

import { ConvexError } from "convex/values";
import { expect } from "vitest";
import { FPL_DEADLINE_RULE } from "../../../convex/gameweeks/deadline";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import type { TestConvex } from "./leagues.harness";
import type { LeagueRules } from "../../../convex/rules/leagueRulesShape";
import { DAY_MS, MINUTE_MS, WEEK_MS } from "../../../convex/shared/time";
import { FIRST_GAMEWEEK, GAMEWEEKS } from "../../../convex/gameweeks/usedGameweeks";
import type { Id } from "../../../convex/_generated/dataModel";

/** The first rules with some parts changed, as a copy the test may change further. */
export function rulesWith(change: Partial<LeagueRules>): LeagueRules {
  return structuredClone({ ...FIRST_RULES, ...change });
}

/** The first rules, played as total points. */
export const TOTAL_POINTS = rulesWith({ format: "totalPoints" });

/** A season of one match a gameweek, a week apart, gameweek `next` kicking off `kicksOffIn` from
 *  now (six days by default), so every gameweek before it has begun. FPL's deadline, feed data
 *  only, is held 90 minutes before each kickoff, as FPL sets it. */
export async function holdGameweeks(
  t: TestConvex,
  { next, kicksOffIn = 6 * DAY_MS }: { next: number; kicksOffIn?: number },
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

/** A refusal the person is shown: a ConvexError carrying the reason. A plain Error reaches the
 *  browser as "Server Error", its message lost. */
export async function expectRefused(attempt: Promise<unknown>, reason: string): Promise<void> {
  const error = await attempt.then(
    () => null,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(ConvexError);
  expect((error as ConvexError<string>).data).toBe(reason);
}
