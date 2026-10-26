import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { passedDeadlinesOf } from "../gameweeks/passedDeadlines";
import { GAMEWEEKS, isGameweekUsed } from "../gameweeks/usedGameweeks";
import { MOST_TEAMS } from "../leagues/leagueLimits";
import type { SeasonRules } from "../rules/rulesHistory";
import { takeAllOrThrow } from "../shared/cappedRead";
import { logFailure } from "../shared/errors";
import {
  gameweekInputs,
  heldFixtures,
  isLocked,
  leagueReads,
  teamInGameweek,
  type LeagueReads,
} from "./teamGameweek";

// Each team's points in each gameweek the league has begun (#29; spec/14; spec/05, Auto-subs;
// spec/07), each worked out by teamGameweek.ts: its lineup in the gameweek, auto-subs from who played, then scoreTeam under the site's
// scoring set in force that gameweek. A gameweek not yet final is worked out on every read: the
// table's query then re-runs whenever a record, a match's state or a lineup changes, so live matches
// move it minute by minute (#28). One final (every match in it locked, so no correction changes it:
// spec/07) is read from finalScores.ts's stored rows, so a season's worth never outgrows one read
// (#418). Little a final gameweek reads changes after: its head-to-heads are stored
// (playedFixtures.ts), the site's set never reaches a gameweek begun (siteScoring.ts), a locked
// match's records no longer change (matchStats.ts) and its lineup is read against the squad at its
// deadline (#415). Its matches can: the stored rows name those they were scored from, and a match
// moved in or out by the football sync reopens the gameweek, to be worked out and stored again.
//
// A gameweek that can't be scored (a site set holding a rule no longer sound, say: #287) is left
// out and named with the reason, logged, rather than blanking or breaking the league's table.

type TeamId = Id<"teams">;

/** A team's points in a gameweek. */
export interface TeamGameweek {
  points: number;
  /** While a record that counts hasn't arrived, or a match it counts isn't locked (spec/07). */
  provisional: boolean;
  /** It has never saved a lineup, so it scores 0: what such a team fields isn't settled. */
  noLineup: boolean;
}

/** A gameweek left out of the table, and why. */
interface Unscored {
  gameweek: number;
  reason: string;
}

export type TeamScores = Map<TeamId, TeamGameweek>;

/** Teams' final points worked out here, not read from finalScores: for it to store. */
interface FinalUnstored {
  gameweek: number;
  /** The teams worked out: every team, or only those added since the rest were stored. */
  teamIds: TeamId[];
  /** The gameweek's matches they were scored from, stored with them. */
  fixtureCodes: number[];
  /** Whether the gameweek's stored rows go first: its matches have changed since, or it had none. */
  replace: boolean;
}

interface LeagueScores {
  /** Gameweek to team to points: each gameweek begun and scored. */
  scores: Map<number, TeamScores>;
  unscored: Unscored[];
  finalUnstored: FinalUnstored[];
}

/** The gameweeks the league plays that have begun since it was made, by its recorded deadlines:
 *  the gameweeks it scores. */
export async function begunGameweeks(ctx: QueryCtx, league: Doc<"leagues">): Promise<number[]> {
  const passed = await passedDeadlinesOf(ctx, league._id);
  return [...passed]
    .filter(([gameweek, deadline]) => deadline >= league._creationTime && isGameweekUsed(league, gameweek))
    .map(([gameweek]) => gameweek)
    .sort((one, other) => one - other);
}

/** Every team's points in each gameweek the league has begun: read from finalScores while the
 *  gameweek holds the same matches it was stored from, else worked out. A team added since the
 *  rest were stored is worked out alone. */
export async function leagueScores(
  ctx: QueryCtx,
  league: Doc<"leagues">,
  season: SeasonRules,
  teamIds: readonly TeamId[],
): Promise<LeagueScores> {
  const gameweeks = await begunGameweeks(ctx, league);
  const result: LeagueScores = { scores: new Map(), unscored: [], finalUnstored: [] };
  if (gameweeks.length === 0 || teamIds.length === 0) return result;
  const stored = await storedFinalScores(ctx, league._id);
  const reads = await leagueReads(ctx, league, season);
  for (const gameweek of gameweeks) {
    try {
      const fixtures = await heldFixtures(ctx, gameweek);
      const fixtureCodes = fixtures.map((fixture) => fixture.code);
      const held = stored.get(gameweek);
      const storedScores = held !== undefined && sameCodes(held.fixtureCodes, fixtureCodes) ? held.scores : new Map<TeamId, TeamGameweek>();
      const unstored = teamIds.filter((teamId) => !storedScores.has(teamId));
      const worked = unstored.length === 0 ? null : await gameweekScores(ctx, reads, gameweek, fixtures, unstored);
      const scores = new Map(teamIds.map((teamId) => [teamId, storedScores.get(teamId) ?? worked!.scores.get(teamId)!]));
      result.scores.set(gameweek, scores);
      if (worked?.final) result.finalUnstored.push({ gameweek, teamIds: unstored, fixtureCodes, replace: storedScores.size === 0 });
    } catch (error) {
      const reason = logFailure(`League ${league._id} (${league.name}) can't score gameweek ${gameweek}`, error);
      result.unscored.push({ gameweek, reason });
    }
  }
  return result;
}

/** The most final rows a league holds: one for each team in each gameweek. */
const FINAL_SCORES_MOST = GAMEWEEKS * MOST_TEAMS;

/** A gameweek's stored final scores, and the matches they were scored from. */
interface StoredGameweek {
  fixtureCodes: number[];
  scores: TeamScores;
}

/** Each gameweek's stored final scores. A gameweek whose rows disagree on its matches counts as
 *  holding none, to be stored again whole. */
async function storedFinalScores(ctx: QueryCtx, leagueId: Id<"leagues">): Promise<Map<number, StoredGameweek>> {
  const rows = await takeAllOrThrow(
    ctx.db.query("finalScores").withIndex("by_leagueId_and_gameweek", (q) => q.eq("leagueId", leagueId)),
    FINAL_SCORES_MOST,
    `League ${leagueId} holds more than ${FINAL_SCORES_MOST} final scores, so some would be left out`,
  );
  const rowsByGameweek = new Map<number, Doc<"finalScores">[]>();
  for (const row of rows) rowsByGameweek.set(row.gameweek, [...(rowsByGameweek.get(row.gameweek) ?? []), row]);
  return new Map([...rowsByGameweek].map(([gameweek, gameweekRows]) => [gameweek, storedGameweekOf(gameweekRows)]));
}

/** One gameweek's stored rows, which are never none: scores for none when they disagree on its matches. */
function storedGameweekOf([first, ...rest]: Doc<"finalScores">[]): StoredGameweek {
  const agree = rest.every((row) => sameCodes(row.fixtureCodes, first.fixtureCodes));
  const scores = new Map<TeamId, TeamGameweek>(
    agree ? [first, ...rest].map(({ teamId, points, noLineup }) => [teamId, { points, provisional: false, noLineup }]) : [],
  );
  return { fixtureCodes: first.fixtureCodes, scores };
}

/** The gameweek's stored final scores while it holds the same `fixtures` it was stored from, as
 *  `leagueScores` reads them for the table; none otherwise. For a screen of one gameweek (the
 *  matchup, #34), so the table and it agree. */
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
function sameCodes(one: readonly number[], other: readonly number[]): boolean {
  const others = new Set(other);
  return one.length === others.size && one.every((code) => others.has(code));
}

/** The teams' points in one gameweek, from its held fixtures, and whether they are final: the
 *  gameweek holds a match and every match in it is locked, so nothing counted is provisional. One
 *  with no match held (each postponed, say) is never final. */
async function gameweekScores(
  ctx: QueryCtx,
  reads: LeagueReads,
  gameweek: number,
  fixtures: readonly Doc<"fixtures">[],
  teamIds: readonly TeamId[],
): Promise<{ scores: TeamScores; final: boolean }> {
  const inputs = await gameweekInputs(ctx, reads, gameweek, fixtures, teamIds);
  const scores = new Map<TeamId, TeamGameweek>();
  for (const teamId of teamIds) {
    const scored = await teamInGameweek(reads, inputs, teamId);
    scores.set(
      teamId,
      scored === null ? { points: 0, provisional: false, noLineup: true } : { points: scored.team.total, provisional: scored.team.provisional, noLineup: false },
    );
  }
  const { matches } = inputs;
  const final = matches.length > 0 && matches.every(isLocked) && [...scores.values()].every((team) => !team.provisional);
  return { scores, final };
}
