import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { begunGameweeks } from "../gameweekScorer/gameweekScores";
import { heldFixtures, isMatchFinal } from "../gameweekScorer/heldMatches";
import { sameCodes } from "../gameweekScorer/storedScores";
import { gameweekInputs, leagueReads, teamInGameweek, type LeagueReads } from "../gameweekScorer/teamGameweek";
import { MOST_TEAMS } from "../leagues/leagueLimits";
import { seasonRules } from "../rules/rulesHistory";
import { takeAllOrThrow } from "../shared/cappedRead";
import { teamsOf } from "../shared/leagueAccess";
import { LEAGUES_STORED_MOST } from "../table/finalScores";
import { statusOf } from "./matchStats";
import { addStats, type Stats } from "./statTotals";
import { countedTeamStats } from "./teamCountedStats";

// Each team's season totals for the stat race (#800, spec/19): what its counted players did
// (teamCountedStats.ts), added in once a gameweek is final, as the table stores its points then
// (finalScores.ts, #418): every match in it locked, so no correction changes it (spec/07), and the
// corrections made in the hour's window before the lock are already in. Each gameweek's share is
// kept (teamGameweekStats), so a gameweek reopened by a match moved in or out takes away what it
// added, and is added again once final. A match's lock asks every league to store, as it asks the
// table; one gameweek is worked out a run, so a season to catch up never outgrows a mutation.
// `rebuild` sets a league's totals afresh, after anything that changes who counted in a stored
// gameweek: an admin's correction to a player's positions (auto-subs read them), say.

type TeamId = Id<"teams">;

/** Asks every league to store its newly final gameweeks' stats, each in its own transaction. Run
 *  once after deploying the tables, to add up the gameweeks already final:
 *  `npx convex run stats/teamSeasonStats:storeEveryLeague`. */
export const storeEveryLeague = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const leagues = await takeAllOrThrow(
      ctx.db.query("leagues"),
      LEAGUES_STORED_MOST,
      `More than ${LEAGUES_STORED_MOST} leagues are held, so some would have their teams' stats unstored`,
    );
    for (const league of leagues) await ctx.scheduler.runAfter(0, internal.stats.teamSeasonStats.storeLeague, { leagueId: league._id });
    return null;
  },
});

/** Brings the league's teams' totals up to date: a reopened gameweek's shares taken away, and the
 *  first final gameweek not yet stored added in, then runs again for the next. Returns the
 *  gameweeks it moved. */
export const storeLeague = internalMutation({
  args: { leagueId: v.id("leagues") },
  returns: v.array(v.number()),
  handler: async (ctx, { leagueId }) => {
    const league = await ctx.db.get("leagues", leagueId);
    if (league === null) return [];
    return await storeNext(ctx, league);
  },
});

/** Drops every share and total the league holds and stores them afresh, gameweek by gameweek:
 *  `npx convex run stats/teamSeasonStats:rebuild '{"leagueId":"..."}'`. Safe to run again. */
export const rebuild = internalMutation({
  args: { leagueId: v.id("leagues") },
  returns: v.null(),
  handler: async (ctx, { leagueId }) => {
    for await (const row of ctx.db.query("teamGameweekStats").withIndex("by_leagueId_and_gameweek_and_teamId", (q) => q.eq("leagueId", leagueId))) {
      await ctx.db.delete("teamGameweekStats", row._id);
    }
    for await (const row of ctx.db.query("teamSeasonStats").withIndex("by_leagueId_and_teamId", (q) => q.eq("leagueId", leagueId))) {
      await ctx.db.delete("teamSeasonStats", row._id);
    }
    await ctx.scheduler.runAfter(0, internal.stats.teamSeasonStats.storeLeague, { leagueId });
    return null;
  },
});

/** Each of the league's teams' season totals, by team. A team with none held has had nothing
 *  counted yet. */
export async function teamTotals(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Map<TeamId, Stats>> {
  const rows = await takeAllOrThrow(
    ctx.db.query("teamSeasonStats").withIndex("by_leagueId_and_teamId", (q) => q.eq("leagueId", leagueId)),
    MOST_TEAMS,
    `League ${leagueId} holds more than ${MOST_TEAMS} teams' stat totals, so some would be left out`,
  );
  return new Map(rows.map((row) => [row.teamId, row.stats]));
}

/** Each begun gameweek in turn: one whose stored shares are all of today's teams from today's
 *  matches is done; one not final has any stale shares taken away; the first final one with a team
 *  to store is worked out, and the league runs again after it. */
async function storeNext(ctx: MutationCtx, league: Doc<"leagues">): Promise<number[]> {
  const season = await seasonRules(ctx, league._id);
  if (season === null) return [];
  const teamIds = (await teamsOf(ctx, league._id)).map((team) => team._id);
  if (teamIds.length === 0) return [];
  const moved: number[] = [];
  let reads: LeagueReads | null = null;
  for (const gameweek of await begunGameweeks(ctx, league)) {
    const fixtures = await heldFixtures(ctx, gameweek);
    const fixtureCodes = fixtures.map((fixture) => fixture.code);
    const shares = await sharesIn(ctx, league._id, gameweek);
    const stale = teamIds.filter((teamId) => {
      const share = shares.get(teamId);
      return share === undefined || !sameCodes(share.fixtureCodes, fixtureCodes);
    });
    if (stale.length === 0) continue;
    if (!(await allLocked(ctx, fixtureCodes))) {
      if (await takeAway(ctx, stale.flatMap((teamId) => shares.get(teamId) ?? []))) moved.push(gameweek);
      continue;
    }
    const leagueRead = (reads ??= await leagueReads(ctx, league, season));
    const inputs = await gameweekInputs(ctx, leagueRead, gameweek, fixtures, stale);
    const scored = await Promise.all(stale.map((teamId) => teamInGameweek(leagueRead, inputs, teamId)));
    // A record not whole after the lock leaves the team's points provisional, and the table stores
    // none of the gameweek's scores then: nor does the stat race, and a share from other matches
    // comes off, as in a gameweek not final. A match locks only once every record its full-time
    // read sent is whole, and none is written after (matchStats.ts), so the one way here is a
    // live tick's record that read left out; it stays so, and the gameweek with it (#805).
    if (scored.some((each) => each.team.provisional)) {
      if (await takeAway(ctx, stale.flatMap((teamId) => shares.get(teamId) ?? []))) moved.push(gameweek);
      continue;
    }
    for (const [index, teamId] of stale.entries()) {
      await storeShare(ctx, { leagueId: league._id, gameweek, teamId, fixtureCodes, stats: countedTeamStats(scored[index]) }, shares.get(teamId));
    }
    moved.push(gameweek);
    await ctx.scheduler.runAfter(0, internal.stats.teamSeasonStats.storeLeague, { leagueId: league._id });
    break;
  }
  return moved;
}

/** Whether the gameweek holds a match and every one is locked: one with none held (each postponed,
 *  say) is never final, as the table has it (gameweekScores.ts). */
async function allLocked(ctx: QueryCtx, fixtureCodes: readonly number[]): Promise<boolean> {
  if (fixtureCodes.length === 0) return false;
  for (const code of fixtureCodes) if (!isMatchFinal({ status: await statusOf(ctx, code) })) return false;
  return true;
}

/** The league's stored shares in the gameweek, by team. */
async function sharesIn(ctx: QueryCtx, leagueId: Id<"leagues">, gameweek: number): Promise<Map<TeamId, Doc<"teamGameweekStats">>> {
  const rows = await takeAllOrThrow(
    ctx.db.query("teamGameweekStats").withIndex("by_leagueId_and_gameweek_and_teamId", (q) => q.eq("leagueId", leagueId).eq("gameweek", gameweek)),
    MOST_TEAMS,
    `League ${leagueId} holds more than ${MOST_TEAMS} teams' stats for gameweek ${gameweek}, so some would be left out`,
  );
  return new Map(rows.map((row) => [row.teamId, row]));
}

type Share = Omit<Doc<"teamGameweekStats">, "_id" | "_creationTime">;

/** The team's share of the gameweek set to `share`, its totals moved by the difference. */
async function storeShare(ctx: MutationCtx, share: Share, held: Doc<"teamGameweekStats"> | undefined): Promise<void> {
  if (held === undefined) await ctx.db.insert("teamGameweekStats", share);
  else await ctx.db.replace("teamGameweekStats", held._id, share);
  await moveTotals(ctx, share.leagueId, share.teamId, addStats(share.stats, held?.stats ?? {}, -1));
}

/** The shares go, and what they added comes off their teams' totals. Whether there were any. */
async function takeAway(ctx: MutationCtx, shares: readonly Doc<"teamGameweekStats">[]): Promise<boolean> {
  for (const share of shares) {
    await ctx.db.delete("teamGameweekStats", share._id);
    await moveTotals(ctx, share.leagueId, share.teamId, addStats({}, share.stats, -1));
  }
  return shares.length > 0;
}

/** The team's totals with `change` added: a row is made with its first stat to count. */
async function moveTotals(ctx: MutationCtx, leagueId: Id<"leagues">, teamId: TeamId, change: Stats): Promise<void> {
  const row = await ctx.db
    .query("teamSeasonStats")
    .withIndex("by_leagueId_and_teamId", (q) => q.eq("leagueId", leagueId).eq("teamId", teamId))
    .unique();
  const stats = addStats(row?.stats ?? {}, change);
  if (row !== null) await ctx.db.patch("teamSeasonStats", row._id, { stats });
  else if (Object.keys(stats).length > 0) await ctx.db.insert("teamSeasonStats", { leagueId, teamId, stats });
}
