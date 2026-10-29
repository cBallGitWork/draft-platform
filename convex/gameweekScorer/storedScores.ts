import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { GAMEWEEKS } from "../gameweeks/usedGameweeks";
import { MOST_TEAMS } from "../leagues/leagueLimits";
import { takeAllOrThrow } from "../shared/cappedRead";
import { groupedBy } from "../shared/groupedBy";
import type { TeamGameweek, TeamScores } from "./gameweekScores";

// The league's stored final scores (finalScores.ts's rows), as the scorer (gameweekScores.ts)
// reads them: a gameweek's stand while it holds the matches they were stored from. Plain helpers:
// no Convex function lives here.

type TeamId = Id<"teams">;

/** The most final rows a league holds: one for each team in each gameweek. */
export const FINAL_SCORES_MOST = GAMEWEEKS * MOST_TEAMS;

/** A gameweek's stored final scores, and the matches they were scored from. */
interface StoredGameweek {
  fixtureCodes: number[];
  scores: TeamScores;
}

/** Each gameweek's stored final scores. A gameweek whose rows disagree on its matches counts as
 *  holding none, to be stored again whole. */
export async function storedFinalScores(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Map<number, StoredGameweek>> {
  const rows = await takeAllOrThrow(
    ctx.db.query("finalScores").withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", leagueId)),
    FINAL_SCORES_MOST,
    `League ${leagueId} holds more than ${FINAL_SCORES_MOST} final scores, so some would be left out`,
  );
  const rowsByGameweek = groupedBy(rows, (row) => row.gameweek);
  return new Map([...rowsByGameweek].map(([gameweek, gameweekRows]) => [gameweek, storedGameweekOf(gameweekRows)]));
}

/** One gameweek's stored rows, which are never none: scores for none when they disagree on its matches. */
function storedGameweekOf([first, ...rest]: Doc<"finalScores">[]): StoredGameweek {
  const agree = rest.every((row) => sameCodes(row.fixtureCodes, first.fixtureCodes));
  const scores = new Map<TeamId, TeamGameweek>(
    agree ? [first, ...rest].map(({ teamId, points, noLineup }) => [teamId, { points, provisional: false, noLineup: noLineup ?? false }]) : [],
  );
  return { fixtureCodes: first.fixtureCodes, scores };
}

/** The gameweek's stored final scores while it holds the same `fixtures` it was stored from, as
 *  the league's scorer reads them for the table; none otherwise. */
export async function storedScoresIn(
  ctx: QueryCtx,
  leagueId: Id<"leagues">,
  gameweek: number,
  fixtures: readonly Doc<"fixtures">[],
): Promise<TeamScores> {
  const rows = await takeAllOrThrow(
    ctx.db.query("finalScores").withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", leagueId).eq("gameweek", gameweek)),
    MOST_TEAMS,
    `League ${leagueId} holds more than ${MOST_TEAMS} final scores for gameweek ${gameweek}, so some would be left out`,
  );
  if (rows.length === 0) return new Map();
  const held = storedGameweekOf(rows);
  return sameCodes(held.fixtureCodes, fixtures.map((fixture) => fixture.code)) ? held.scores : new Map();
}

/** Whether two lists hold the same match codes, in any order. */
export function sameCodes(one: readonly number[], other: readonly number[]): boolean {
  const others = new Set(other);
  return one.length === others.size && one.every((code) => others.has(code));
}
