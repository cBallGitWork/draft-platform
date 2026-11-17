import { describe, expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { FIRST_SCORING_WITH_ROLES } from "../../../convex/scoring/draftedRoleAdjustments";
import { holdSiteScoring, t, TODAY, useSiteScoringDeployment } from "../../support/convex/siteScoring.harness";

// The redrawn roles' backtest from one command (#1446; spec/05 S05.10, S05.33): the site's latest
// set over the past seasons, each past man matched to Sportmonks through FPL's code (#1421).

useSiteScoringDeployment();

const SAKA = { fplCode: 10, sportmonks: 9010 };
const HAALAND = { fplCode: 11, sportmonks: 9011 };

/** Two starts up front in 2024/25: Saka's, whom Sportmonks has as a winger, and Haaland's, a
 *  centre-forward, each with a goal and two shots on target. */
const holdPastStartsAndLinks = () =>
  t.run(async (ctx) => {
    await holdSiteScoring(ctx, { scoring: FIRST_SCORING_WITH_ROLES, kind: "fix", at: TODAY - 1 });
    for (const [man, label] of [
      [SAKA, "Right Wing"],
      [HAALAND, "Centre Forward"],
    ] as const) {
      const stats = { goals_scored: 1, ontarget_scoring_att: 2, big_chance_missed: 0 };
      await ctx.db.insert("pastPlayerMatchStats", { season: 2024, playerCode: man.fplCode, fplPosition: 4, match: { kickoff: 1, club: "Leeds", startingPosition: "ST", stats } });
      await ctx.db.insert("sportmonksFplLinks", { kind: "player", code: man.sportmonks, fplCode: man.fplCode, candidates: [], since: 0 });
      await ctx.db.insert("sportmonksPlayerStarts", { playerCode: man.sportmonks, label, starts: [] });
    }
  });

describe("the backtest's one command", () => {
  test("S05.29 S05.10 prints every role of the site's set, a winger's start up front left out of poacher's, and a failing role refitted", async () => {
    await holdPastStartsAndLinks();

    const { lines, averages } = await t.action(internal.balanceLab.roleBacktestRun.run, {});

    // Haaland's 2 × 1 goal + 2 shots on target is 4, past poacher's three bars at 2, 3 and 4: +3.
    expect(lines).toContain("ST poacher: 1 starts, average 3, target 0.5, fail");
    expect(lines).toContain("Refitted, old → new:");
    expect(lines.some((line) => line.startsWith("ST poacher: bonus bars 2, 3, 4"))).toBe(true);
    expect(averages).toContainEqual({ role: "poacher", slot: "ST", target: 0.5, starts: 1, average: 3 });
  });
});
