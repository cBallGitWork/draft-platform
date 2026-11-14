import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { begunGameweeks, gameweekScorer, tableGameweek } from "../gameweekScorer/gameweekScores";
import { heldFixtures } from "../gameweekScorer/heldMatches";
import { heldLiveScores } from "./liveRescore";
import { leagueReads } from "../gameweekScorer/teamGameweek";
import { earliestDelay } from "../football/matchCommentary";
import type { HeldCommentary } from "../matchup/matchupShape";
import { commentaryByMatch, commentaryReads } from "../matchup/readCommentary";
import { shownLine } from "../matchup/vidiprinter";
import { seasonRules, type SeasonRules } from "../rules/rulesHistory";
import { everyLeague } from "../shared/cappedRead";
import { leagueLabel, logFailure } from "../shared/errors";
import { teamsOf } from "../shared/leagueAccess";

// The live gameweek scored once a tick (#2007, #1995's quota cuts). While a match is on, its
// records move every minute, and every open Table, Home and Matchup used to score the whole league
// again for itself, reading every record of every match. Instead each live tick
// (stats/liveStatsSync.ts) scores each league's live gameweek here, once, into one small row: each
// team's points and the gameweek's lines that move a head-to-head, priced. The screens' queries
// read that row (gameweekScores.ts's `leagueScores`, home/leagueHome.ts's `matchdayOf`,
// matchup/matchup.ts's league average), which changes only when a score or a line does.
//
// The row stands only while it was scored for the league's teams from the gameweek's matches
// (storedScores.ts's `standsFor`); otherwise, and with none, a screen works the gameweek out itself
// as before. A change between ticks that moves the gameweek's scores asks for it again at once: a
// match's records or state written (stats/matchStats.ts: a correction, full time, the lock), a
// commissioner's override (finalScores.ts's `rescoreGameweek`) and a squad move (mail/letters.ts's
// `fileEvent`), each through liveRescore.ts. Once no match is live the tick clears every row, so nothing read after a matchday
// comes from here.

type LiveFields = Omit<Doc<"liveScores">, "_id" | "_creationTime">;
type LiveVidiprinter = LiveFields["vidiprinter"];

/** Each league's live rows scored afresh for the `gameweeks` its live matches are in, each league
 *  in its own transaction, so one that can't be scored never holds up the rest; with none, every
 *  row goes. */
export const scoreEveryLeague = internalMutation({
  args: { gameweeks: v.array(v.number()) },
  returns: v.null(),
  handler: async (ctx, { gameweeks }) => {
    for (const league of await everyLeague(ctx, "so some would keep a stale live score")) {
      await ctx.scheduler.runAfter(0, internal.table.liveScores.scoreLeague, { leagueId: league._id, gameweeks });
    }
    return null;
  },
});

/** The league's live rows: one written for each of the `gameweeks` it has begun, the rest gone. A
 *  row is written only when it changes, so a tick that moved nothing re-runs no screen's query. */
export const scoreLeague = internalMutation({
  args: { leagueId: v.id("leagues"), gameweeks: v.array(v.number()) },
  returns: v.null(),
  handler: async (ctx, { leagueId, gameweeks }) => {
    const held = await heldLiveScores(ctx, leagueId);
    const league = await ctx.db.get("leagues", leagueId);
    const begun = league === null ? [] : await begunGameweeks(ctx, league);
    const teamIds = (await teamsOf(ctx, leagueId)).map((team) => team._id);
    for (const [gameweek, row] of held) if (!gameweeks.includes(gameweek)) await ctx.db.delete("liveScores", row._id);
    for (const gameweek of gameweeks) {
      const row = held.get(gameweek) ?? null;
      const fields = league === null || !begun.includes(gameweek) || teamIds.length === 0 ? null : await scoredLive(ctx, league, teamIds, gameweek);
      await keep(ctx, row, fields);
    }
    return null;
  },
});

/** The row written, replaced where it changed, or gone where there is none to write. */
async function keep(ctx: MutationCtx, row: Doc<"liveScores"> | null, fields: LiveFields | null): Promise<void> {
  if (fields === null) {
    if (row !== null) await ctx.db.delete("liveScores", row._id);
  } else if (row === null) await ctx.db.insert("liveScores", fields);
  else if (!sameFields(row, fields)) await ctx.db.replace("liveScores", row._id, fields);
}

const sameFields = ({ _id, _creationTime, ...held }: Doc<"liveScores">, fields: LiveFields) => JSON.stringify(held) === JSON.stringify(fields);

/** The gameweek scored as the table scores it, and its Vidiprinter. One that can't be scored, or
 *  whose scorer can't even be read, leaves no row, so the screens work it out and show why. */
async function scoredLive(ctx: MutationCtx, league: Doc<"leagues">, teamIds: Id<"teams">[], gameweek: number): Promise<LiveFields | null> {
  const season = await seasonRules(ctx, league._id);
  const fixtureCodes = (await heldFixtures(ctx, gameweek)).map((fixture) => fixture.code);
  let scoredGameweek: Awaited<ReturnType<typeof gameweekScorer>>;
  try {
    scoredGameweek = await gameweekScorer(ctx, league, season);
  } catch (error) {
    logFailure(`${leagueLabel(league)} can't read its scorer for gameweek ${gameweek}'s live scores`, error);
    return null;
  }
  let teams: LiveFields["teams"];
  try {
    const { scores } = await scoredGameweek(gameweek, teamIds);
    teams = { kind: "scored", scores: teamIds.map((teamId) => ({ teamId, ...scores.get(teamId)! })) };
  } catch (error) {
    // As leagueScores words it.
    teams = { kind: "unscored", reason: logFailure(`${leagueLabel(league)} can't score gameweek ${gameweek}`, error) };
  }
  return { leagueId: league._id, gameweek, teamIds, fixtureCodes, teams, vidiprinter: await gameweekVidiprinter(ctx, league, season, teamIds, gameweek) };
}

/** The lines of every match of a begun gameweek that move a head-to-head, priced for each lineup's
 *  men whose points count, each with its match; one that can't be read is logged and says why,
 *  while the scores still show. Read by the tick for the live row, and by `matchdayOf` with none. */
export async function gameweekVidiprinter(
  ctx: QueryCtx,
  league: Doc<"leagues">,
  season: SeasonRules,
  teamIds: readonly Id<"teams">[],
  gameweek: number,
): Promise<LiveVidiprinter> {
  try {
    const inGameweek = await tableGameweek(ctx, await leagueReads(ctx, league, season), gameweek, teamIds);
    const { lines, delays } = await commentaryByMatch(ctx, inGameweek, teamIds, commentaryReads(ctx), { countingOnly: true });
    return { kind: "read", lines: lines.filter((line) => line.points !== null).map((line) => ({ fixtureCode: line.fixtureCode, ...shownLine(line) })), delays };
  } catch (error) {
    return { kind: "unread", reason: logFailure(`${leagueLabel(league)} can't read gameweek ${gameweek}'s Vidiprinter`, error) };
  }
}

/** The matchday's Vidiprinter, of its matches `fixtureCodes`, from the gameweek's: their lines,
 *  newest first, and the earliest of their delays. */
export function matchdayOfLines(priced: LiveVidiprinter, fixtureCodes: ReadonlySet<number>): HeldCommentary {
  if (priced.kind === "unread") return priced;
  return {
    kind: "read",
    lines: priced.lines.filter((line) => fixtureCodes.has(line.fixtureCode)).map(shownLine),
    delayedFrom: earliestDelay(priced.delays.filter((delay) => fixtureCodes.has(delay.fixtureCode)).map(({ delayedFrom }) => delayedFrom)),
  };
}
