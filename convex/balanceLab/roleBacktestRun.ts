import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalQuery } from "../_generated/server";
import { PLAYERS_MOST } from "../football/sportmonks/fplLinksSync";
import { sportmonksPositionsOf } from "../football/sportmonks/sportmonksPositions";
import type { Position } from "../positions/positionTables";
import { position } from "../schema";
import { latestSiteScoring } from "../scoring/siteVersions";
import { scoringSetShape, type StoredScoringSet } from "../scoring/scoringSetShape";
import { takeAllOrThrow } from "../shared/cappedRead";
import { pastStarts } from "./balanceLabRun";
import { backtestLines, roleAverages, roleBacktest, type RoleAverage } from "./roleBacktest";

// Running the redrawn roles' backtest (#1446; spec/05 S05.10, S05.33) on the site's latest set,
// from one command, on dev, where the past seasons are (Craig, 7 Nov 2026, on #10: "an internal
// Convex query run on dev with `npx convex run`", no new CI secret):
//   npx convex run balanceLab/roleBacktestRun:run
// It prints every role, and each failing role's bars refitted old against new; it returns the same
// lines, and the averages for tests/support/golden/role-backtest.json, whose test fails a role more
// than 0.25 off its target. A session Craig watches runs it, commits that file and puts any refit
// in a patch (Craig, 17 Nov 2026, on #1446).

/** Each Premier League man linked to FPL's code (#1421), by that code: his Sportmonks positions,
 *  none where Sportmonks has given him none yet. */
export const matchedPositions = internalQuery({
  args: {},
  returns: v.array(v.object({ fplCode: v.number(), positions: v.array(position) })),
  handler: async (ctx) => {
    const links = await takeAllOrThrow(
      ctx.db.query("sportmonksFplLinks").withIndex("by_kind_and_code", (q) => q.eq("kind", "player")),
      PLAYERS_MOST,
      `More than ${PLAYERS_MOST} men are linked to FPL's codes`,
    );
    return Promise.all(
      links.flatMap(({ code, fplCode }) => {
        if (fplCode === null) return [];
        return [
          ctx.db
            .query("sportmonksPlayerStarts")
            .withIndex("by_playerCode", (q) => q.eq("playerCode", code))
            .unique()
            .then((row) => ({ fplCode, positions: row === null ? [] : sportmonksPositionsOf(row.starts, row.label ?? null).positions.map(({ position }) => position) })),
        ];
      }),
    );
  },
});

/** The site's latest scoring set: the one the next patch builds on. */
export const latestSet = internalQuery({ args: {}, returns: scoringSetShape, handler: (ctx) => latestSiteScoring(ctx) });

/** The backtest of the site's latest set over every past season copied. */
export const run = internalAction({
  args: {},
  returns: v.object({
    lines: v.array(v.string()),
    averages: v.array(v.object({ role: v.string(), slot: v.string(), target: v.number(), starts: v.number(), average: v.number() })),
  }),
  handler: async (ctx): Promise<{ lines: string[]; averages: RoleAverage[] }> => {
    const set: StoredScoringSet = await ctx.runQuery(internal.balanceLab.roleBacktestRun.latestSet, {});
    const matched: { fplCode: number; positions: Position[] }[] = await ctx.runQuery(internal.balanceLab.roleBacktestRun.matchedPositions, {});
    const starts = await pastStarts(ctx);
    const backtest = roleBacktest(set, starts, new Map(matched.map(({ fplCode, positions }) => [fplCode, positions])));
    const lines = backtestLines(backtest);
    for (const line of lines) console.log(line);
    return { lines, averages: roleAverages(backtest.roles) };
  },
});
