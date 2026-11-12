import type { QueryCtx } from "../_generated/server";
import { scoreOf } from "../football/matchScores";
import { gameweekFixtures } from "../shared/fixtures";
import { latestBegun, latestOf, type LeagueDeadlines } from "./deadline";
import { seasonGameweekCount } from "./seasonGameweeks";
import { isGameweekUsed, type WithUnusedGameweeks } from "./usedGameweeks";

// When a gameweek is over: once begun it is under way until every match the feed still sends in it
// is at full time. Waivers (../waivers/waiverLock.ts), trades (../trades/tradeShut.ts) and lineup
// saves (../lineup/lineups.ts) all read it.

/** Whether a gameweek has a match not yet at full time, or with no score read yet: it is under way
 *  once begun, until its last match is over. */
export async function gameweekUnderWay(ctx: QueryCtx, gameweek: number): Promise<boolean> {
  return (await gameweekEnd(ctx, gameweek)).underWay;
}

/** Whether the gameweek is under way, and once it isn't, when its last match was first read at
 *  full time: null when one was there before that moment was kept (../football/matchScores.ts). */
export async function gameweekEnd(ctx: QueryCtx, gameweek: number): Promise<{ underWay: true } | { underWay: false; endedAt: number | null }> {
  const matches = await gameweekFixtures(ctx, gameweek, "whether its last match is over can't be told");
  const scores = await Promise.all(matches.map(({ code }) => scoreOf(ctx, code)));
  const over = scores.flatMap((score) => (score?.state === "fullTime" ? [score.fullTimeAt ?? null] : []));
  if (over.length < scores.length) return { underWay: true };
  const kept = over.filter((at): at is number => at !== null);
  return { underWay: false, endedAt: kept.length < over.length ? null : latestOf(kept) };
}

/** Whether the league is at `now` in a gameweek it doesn't play, from that gameweek's deadline
 *  until its last match is over: spec/13, "Lineups, waivers, free agency and trades are locked
 *  through it". The waiver lock already covers that span for waivers and free agency; trades
 *  (../trades/tradeShut.ts) and lineup saves (../lineup/lineups.ts) read this. */
export async function inUnplayedGameweek(ctx: QueryCtx, league: WithUnusedGameweeks, deadlines: LeagueDeadlines, now: number): Promise<boolean> {
  const gameweek = latestBegun(deadlines, now);
  return gameweek !== null && !isGameweekUsed(league, gameweek, await seasonGameweekCount(ctx)) && (await gameweekUnderWay(ctx, gameweek));
}
