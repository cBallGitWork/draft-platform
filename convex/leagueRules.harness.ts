// League rules' tests' shared setup (#25). For the tests only: the second dot keeps it out of
// Convex's deploy.

import { ConvexError } from "convex/values";
import { expect } from "vitest";
import { FPL_DEADLINE_RULE, MS_PER_MINUTE } from "./deadline";
import { FIRST_RULES } from "./firstRules";
import type { TestConvex } from "./leagues.harness";
import type { LeagueRules } from "./leagueRulesShape";

/** The first rules with some parts changed, as a copy the test may change further. */
export function rulesWith(change: Partial<LeagueRules>): LeagueRules {
  return structuredClone({ ...FIRST_RULES, ...change });
}

/** The first rules, played as total points. */
export const TOTAL_POINTS = rulesWith({ format: "totalPoints" });

export const HOUR_MS = 60 * MS_PER_MINUTE;
const WEEK_MS = 7 * 24 * HOUR_MS;
const SEASON_GAMEWEEKS = 38;

/** A season of one match a gameweek, a week apart, gameweek `next` kicking off `kicksOffIn` from
 *  now (six days by default), so every gameweek before it has begun and FPL's deadline for it is
 *  90 minutes before. */
export async function holdGameweeks(t: TestConvex, { next, kicksOffIn = 6 * 24 * HOUR_MS }: { next: number; kicksOffIn?: number }) {
  const kickoffOf = (gameweek: number) => Date.now() + kicksOffIn + (gameweek - next) * WEEK_MS;
  await t.run(async (ctx) => {
    for (let number = 1; number <= SEASON_GAMEWEEKS; number += 1) {
      const kickoff = kickoffOf(number);
      await ctx.db.insert("gameweeks", { number, deadline: kickoff - FPL_DEADLINE_RULE.minutesBeforeFirstKickoff * MS_PER_MINUTE });
      await ctx.db.insert("fixtures", { code: number, gameweek: number, homeClubCode: 1, awayClubCode: 2, kickoff });
    }
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
