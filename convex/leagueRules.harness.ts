// League rules' tests' shared setup (#25). For the tests only: the second dot keeps it out of
// Convex's deploy.

import { FIRST_RULES } from "./firstRules";
import type { TestConvex } from "./leagues.harness";
import type { LeagueRules } from "./leagueRulesShape";

/** The first rules with some parts changed, as a copy the test may change further. */
export function rulesWith(change: Partial<LeagueRules>): LeagueRules {
  return structuredClone({ ...FIRST_RULES, ...change });
}

/** The first rules, played as total points. */
export const TOTAL_POINTS = rulesWith({ format: "totalPoints" });

const DAY_MS = 24 * 60 * 60_000;
const SEASON_GAMEWEEKS = 38;

/** A season of one match a gameweek, a week apart, with gameweek `lockedThrough` kicking off a
 *  day ago, so its deadline and every one before it have passed and the rest are ahead. */
export async function holdGameweeks(t: TestConvex, { lockedThrough }: { lockedThrough: number }): Promise<void> {
  const kickoffOf = (gameweek: number) => Date.now() - DAY_MS + (gameweek - lockedThrough) * 7 * DAY_MS;
  await t.run(async (ctx) => {
    for (let number = 1; number <= SEASON_GAMEWEEKS; number += 1) {
      const kickoff = kickoffOf(number);
      await ctx.db.insert("gameweeks", { number, deadline: kickoff - 90 * 60_000 });
      await ctx.db.insert("fixtures", { code: number, gameweek: number, homeClubCode: 1, awayClubCode: 2, kickoff });
    }
  });
}
