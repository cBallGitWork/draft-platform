// The feeds page's tests' shared setup: each feed's run rows written as its sync or tick records
// them, and the page's report read as the admin at a given time.

import { api } from "../../../convex/_generated/api";
import type { FeedsReport } from "../../../convex/admin/feeds";
import type { Feed } from "../../../convex/shared/feedSchedule";
import { asAdmin } from "./positionsSync.harness";
import type { TestConvex } from "./test.harness";

export { asAdmin };

/** The time the tests' runs start from. */
export const T0 = Date.parse("2026-10-17T12:00:00Z");

const NO_WRITES = { received: 0, inserted: 0, updated: 0, marked: 0, unmarked: 0 };

/** What a run found: a success, the run failing whole, or (a sync or tick reading matches) one
 *  of its matches failing. */
export type Ran = "ok" | { error: string } | { matchError: string };

/** One run of `feed` started at `ranAt`, recorded as its sync or tick does. */
export function recordRun(t: TestConvex, feed: Feed, ranAt: number, ran: Ran = "ok") {
  const failed = typeof ran === "object" && "error" in ran ? { ok: false as const, error: ran.error } : null;
  const matches =
    typeof ran === "object" && "matchError" in ran ? [{ fixtureCode: 1, ok: false as const, error: ran.matchError }] : [];
  return t.run(async (ctx) => {
    if (feed === "football") {
      const ok = { ok: true as const, clubs: NO_WRITES, players: NO_WRITES, fixtures: NO_WRITES, gameweeks: NO_WRITES };
      await ctx.db.insert("footballSyncs", { trigger: "cron", ranAt, outcome: failed ?? ok });
    } else if (feed === "positions") {
      const ok = {
        ok: true as const,
        matchesRead: 0,
        matchesLeft: 0,
        matchesRefused: [],
        startsAdded: 0,
        unmatchedPlayers: 0,
        labelsReceived: 0,
        labelsChanged: 0,
        unknownFormations: [],
        unknownLabels: [],
      };
      await ctx.db.insert("positionsSyncs", { trigger: "manual", ranAt, outcome: failed ?? ok });
    } else if (feed === "matchStats") {
      await ctx.db.insert("matchStatsSyncs", { trigger: "manual", ranAt, outcome: failed ?? { ok: true, matches, waiting: [] } });
    } else {
      await ctx.db.insert("liveStatsTicks", { ranAt, outcome: failed ?? { ok: true, matches } });
    }
  });
}

/** The page's report as the admin sees it at `now`. */
export async function feedsAt(t: TestConvex, now: number): Promise<FeedsReport> {
  return (await asAdmin(t)).query(api.admin.feeds.feeds, { now });
}

/** One feed's row of the report at `now`. */
export async function feedAt(t: TestConvex, feed: Feed, now: number) {
  const row = (await feedsAt(t, now)).feeds.find((each) => each.feed === feed);
  if (row === undefined) throw new Error(`the report has no ${feed} row`);
  return row;
}

/** A held match between two held clubs, kicked off at `kickoff`. */
export function holdMatch(t: TestConvex, code: number, kickoff: number, clubs = { home: "Hull City", away: "Everton" }) {
  return t.run(async (ctx) => {
    await ctx.db.insert("clubs", { code: code * 10, name: clubs.home, shortName: "HOM" });
    await ctx.db.insert("clubs", { code: code * 10 + 1, name: clubs.away, shortName: "AWA" });
    await ctx.db.insert("fixtures", { code, gameweek: 8, homeClubCode: code * 10, awayClubCode: code * 10 + 1, kickoff });
  });
}

/** A match the match-stats sync read at full time at `fullTimeAt`, still in `state`. */
export function holdStatus(t: TestConvex, fixtureCode: number, fullTimeAt: number, state: "provisional" | "complete" = "provisional") {
  return t.run((ctx) => ctx.db.insert("matchStatsStatus", { fixtureCode, state, fullTimeAt, lastReadAt: fullTimeAt }));
}
