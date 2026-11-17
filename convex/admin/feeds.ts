import { v, type Infer } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import { statCorrectionWindowMs } from "./platformSettings";
import { earliest, type FeedState } from "./feedState";
import { feedStatusOf } from "./feedStatuses";
import { takeShown } from "../shared/cappedRead";
import { fixtureByCode } from "../shared/fixtures";
import { adminOf } from "../shared/leagueAccess";
import { findClubByCode, playerByCode } from "../shared/players";
import { FEEDS, feedValidator, isSportmonksFeed } from "../shared/feedSchedule";
import { liveMatches } from "../stats/liveStats";
import { dueSheetsAt } from "../football/matchTeamSheets";
import { sportmonksLiveMatches } from "../football/sportmonks/sportmonksLive";
import { competitionsHeld } from "../football/sportmonks/sportmonksSync";
import { LINEUPS_OUT_BEFORE_KICKOFF_MS, seasonStartAt } from "../shared/time";
import { lateStatChange } from "../schema";

// The admin's feeds page (#35; spec/15 The admin): when each feed last arrived and whether it is
// late or failing, the matches whose scoring is behind, and stat corrections after a lock.
//
// Lateness needs the time, and a query must not read the clock: Convex caches a query by its
// arguments and re-runs it only when the data it read changes, so a stopped feed, which changes
// nothing, would never turn late (convex/_generated/ai/guidelines.md). So the page reads in two
// (#2500): `feeds`, each feed's status row and the corrections, which takes no time and is read
// again only when they change; and `owed`, from when each feed owes a success and the matches
// behind, which the screen asks with `now`, moved on each minute. The screen judges each feed
// against the minute with `feedsReportAt` (feedState.ts).

/** Matches behind, and late corrections, the page lists at most: newest corrections first. */
export const BEHIND_SHOWN = 20;
export const CORRECTIONS_SHOWN = 20;

const feedRead = v.object({
  feed: feedValidator,
  /** For a Sportmonks feed, the competition this row is: one row each that is on (#1414). */
  competition: v.optional(v.string()),
  /** Its league id, which `owed`'s live kickoffs name it by. */
  competitionId: v.optional(v.number()),
  lastRun: v.union(v.object({ ranAt: v.number(), failure: v.union(v.string(), v.null()), betweenSeasons: v.optional(v.boolean()) }), v.null()),
  lastSuccessAt: v.union(v.number(), v.null()),
  /** The newest failure among the runs looked back on (`RUNS_READ`), and when its run started. */
  lastError: v.union(v.object({ at: v.number(), error: v.string() }), v.null()),
});

/** A match by its clubs' names; null if the football sync holds no such match or club. */
const matchNamed = v.union(v.object({ home: v.string(), away: v.string() }), v.null());

const feedsRead = v.object({
  feeds: v.array(feedRead),
  /** Whether more corrections came than `corrections` lists: the page says so, never a silent cut. */
  moreCorrections: v.boolean(),
  corrections: v.array(
    v.object({
      fixtureCode: v.number(),
      match: matchNamed,
      playerCode: v.number(),
      player: v.union(v.string(), v.null()),
      seenAt: v.number(),
      changes: v.array(lateStatChange),
    }),
  ),
});
export type FeedsRead = Infer<typeof feedsRead>;

const nullableTime = v.union(v.number(), v.null());

const feedsOwed = v.object({
  /** The time the feeds are judged at, for the screen's "ago". */
  now: v.number(),
  /** From when each feed that owes a success only at times owes one (`owedSinceAt`); null while it owes none. */
  owedSince: v.object({ matchStats: nullableTime, liveStats: nullableTime, teamSheets: nullableTime }),
  /** Each Sportmonks match live now, by its competition's league id: its live tick owes a success from the first kickoff. */
  liveKickoffs: v.array(v.object({ competition: v.number(), kickoff: v.number() })),
  /** Matches at full time still provisional when their correction window closed (spec/07):
   *  a feed's record is missing, so their points can't lock. Longest behind first. */
  behind: v.array(v.object({ fixtureCode: v.number(), match: matchNamed, fullTimeAt: v.number() })),
  /** Whether more are behind than `behind` lists. */
  moreBehind: v.boolean(),
});
export type FeedsOwed = Infer<typeof feedsOwed>;

/** The page as the admin sees it: each feed judged at `now`. */
export type FeedsReport = Omit<FeedsRead, "feeds"> &
  Omit<FeedsOwed, "owedSince" | "liveKickoffs"> & {
    feeds: {
      feed: FeedsRead["feeds"][number]["feed"];
      competition?: string;
      state: FeedState;
      lastRunAt: number | null;
      lastSuccessAt: number | null;
      lastError: FeedsRead["feeds"][number]["lastError"];
    }[];
  };

export const feeds = query({
  args: {},
  returns: feedsRead,
  handler: async (ctx) => {
    await adminOf(ctx);
    const competitionsOn = (await competitionsHeld(ctx)).filter((each) => each.on);
    const feeds: Infer<typeof feedRead>[] = [];
    for (const feed of FEEDS) {
      if (!isSportmonksFeed(feed)) {
        feeds.push({ feed, ...(await feedStatusOf(ctx, feed)) });
        continue;
      }
      // Each competition that is on is its own row (#1414), so one failing never hides another.
      for (const { name, competition } of competitionsOn) {
        feeds.push({ feed, competition: name, competitionId: competition, ...(await feedStatusOf(ctx, feed, competition)) });
      }
    }
    const corrections = [];
    const latestCorrections = await takeShown(ctx.db.query("lateStatCorrections").order("desc"), CORRECTIONS_SHOWN);
    for (const { fixtureCode, playerCode, seenAt, changes } of latestCorrections.rows) {
      const player = await playerByCode(ctx, playerCode);
      corrections.push({ fixtureCode, match: await matchName(ctx, fixtureCode), playerCode, player: player?.name ?? null, seenAt, changes });
    }
    return { feeds, moreCorrections: latestCorrections.more, corrections };
  },
});

export const owed = query({
  args: { now: v.number() },
  returns: feedsOwed,
  handler: async (ctx, { now }) => {
    await adminOf(ctx);
    const live = await sportmonksLiveMatches(ctx, now);
    const windowMs = await statCorrectionWindowMs(ctx);
    const provisional = await takeShown(
      ctx.db.query("matchStatsStatus").withIndex("by_state_and_fullTimeAt", (q) => q.eq("state", "provisional").lt("fullTimeAt", now - windowMs)),
      BEHIND_SHOWN,
    );
    const behind = [];
    for (const { fixtureCode, fullTimeAt } of provisional.rows) {
      behind.push({ fixtureCode, match: await matchName(ctx, fixtureCode), fullTimeAt });
    }
    return {
      now,
      owedSince: await owedSinceAt(ctx, now),
      liveKickoffs: live.map(({ competition, kickoff }) => ({ competition, kickoff })),
      behind,
      moreBehind: provisional.more,
    };
  },
});

/** From when the feeds owed a success only at times owe one (`judgeFeed`): the live tick, and the
 *  team stats and threshold lines it reads, from the first kickoff of the matches live now; the
 *  team sheets from the first due match's hour before kickoff; late stats from the first full time
 *  of this season's matches not yet locked, as a run with none due writes no row (#2002); none of
 *  those otherwise. Every other feed always owes one (feedState.ts's `owedSinceOf`). */
async function owedSinceAt(ctx: QueryCtx, now: number): Promise<FeedsOwed["owedSince"]> {
  const liveStats = earliest((await liveMatches(ctx, now)).map((match) => match.kickoff));
  const teamSheets = earliest((await dueSheetsAt(ctx, now)).map((match) => match.kickoff - LINEUPS_OUT_BEFORE_KICKOFF_MS));
  const firstUnlocked = (state: "provisional" | "complete") =>
    ctx.db
      .query("matchStatsStatus")
      .withIndex("by_state_and_fullTimeAt", (q) => q.eq("state", state).gte("fullTimeAt", seasonStartAt(now)))
      .first();
  const unlocked = [await firstUnlocked("provisional"), await firstUnlocked("complete")];
  return { matchStats: earliest(unlocked.flatMap((status) => (status === null ? [] : [status.fullTimeAt]))), liveStats, teamSheets };
}

async function matchName(ctx: QueryCtx, fixtureCode: number): Promise<Infer<typeof matchNamed>> {
  const fixture = await fixtureByCode(ctx, fixtureCode);
  if (fixture === null) return null;
  const [home, away] = await Promise.all([clubName(ctx, fixture.homeClubCode), clubName(ctx, fixture.awayClubCode)]);
  return home === null || away === null ? null : { home, away };
}

async function clubName(ctx: QueryCtx, code: number): Promise<string | null> {
  return (await findClubByCode(ctx, code))?.name ?? null;
}
