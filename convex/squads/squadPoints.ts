import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { scoredMatches } from "../gameweekScorer/scoredMatches";
import type { Position } from "../positions/positionTables";
import { inTenths } from "../scoring/values";
import { FORM_GAMEWEEKS } from "./squadLimits";

// A Squad row's points (teamSquad.ts): what his team got from him in a gameweek and in its form
// gameweeks, and his panel's Started and Role points, from his matches as his card prices them.

/** One priced match: its gameweek, its points (null while his whole record hasn't arrived), and
 *  whether his team got them: scored at his slot, not left out or priced at his best position. */
type PricedMatch = { gameweek: number; points: number | null; counted: boolean };

/** One of his matches for his panel's Started and Role points: whether he stood in his team's
 *  scoring eleven, whether his team got its points, and his role's points in it, null with no role
 *  line (none scored, or an override in its place). */
type ElevenMatch = Pick<PricedMatch, "points" | "counted"> & { inEleven: boolean; rolePoints: number | null };

/** His panel's Started and Role points (spec/12 Squad; Craig, 6 Nov 2026, #1005): the matches he
 *  stood in his team's scoring eleven for, auto-subs in, so a sub who came on gets the start and
 *  the man he replaced none; and what his roles added or took away in the matches his team got,
 *  never his roles for another team, nor a team instruction's line. A live gameweek counts
 *  provisionally, as his gameweeks' points do. Role points is null ("—") while his team has got no
 *  priced match of his. */
export function squadEleven(matches: readonly ElevenMatch[]) {
  const counted = matches.filter((match) => match.counted && match.points !== null);
  return {
    started: matches.filter((match) => match.inEleven).length,
    rolePoints: counted.length === 0 ? null : inTenths(counted.reduce((total, { rolePoints }) => total + (rolePoints ?? 0), 0)),
  };
}

/** What his team got from him in `gameweek` from his priced matches: the sum of those it counted,
 *  kept to tenths as the table keeps them, or null while none there is priced, and for no gameweek. */
export function gameweekPoints(matches: readonly PricedMatch[], gameweek: number | null): number | null {
  const priced = matches.filter((match): match is PricedMatch & { points: number } => match.gameweek === gameweek && match.points !== null);
  if (priced.length === 0) return null;
  return inTenths(priced.reduce((total, { points, counted }) => (counted ? total + points : total), 0));
}

/** His points in each of `begun`'s last FORM_GAMEWEEKS gameweeks, oldest first, each added up as
 *  the last gameweek's are (gameweekPoints). */
export function squadForm(matches: readonly PricedMatch[], begun: readonly number[]): (number | null)[] {
  return begun.slice(-FORM_GAMEWEEKS).map((gameweek) => gameweekPoints(matches, gameweek));
}

/** Prices a player's season's matches as his card does (scoredMatches.ts): each match's total,
 *  the league's override where it holds one, and whether it was scored at his slot.
 *
 *  What a full squad costs: each player's records and their matches (about 25 x 2 x the gameweeks
 *  played) and his overrides in the league, and each gameweek begun, read once for the team: its
 *  lineup, which reads the league's squad moves since that gameweek's deadline (lineups.ts), each
 *  match's state, and the records of the men in the lineup. Inside a query's limits for a season of
 *  an ordinary league; past SQUAD_MOVES_READ_MOST moves of a kind it throws rather than mis-price.
 *  Storing a gameweek's priced matches once final, as finalScores.ts does the totals, is the way on
 *  if it grows. Beside it the read adds one season-totals row and one season-points row a player, the
 *  league's overrides and rules, and
 *  reads the matches ahead until every club has three, so it grows with the squad, never the league. */
export async function pricer(ctx: QueryCtx, league: Doc<"leagues">, teamId: Id<"teams">) {
  const scored = await scoredMatches(ctx, league, teamId);
  return async (code: number, positions: readonly Position[]): Promise<(PricedMatch & ElevenMatch)[]> =>
    (await scored.of({ code, positions })).map(({ gameweek, points, counted, inEleven }) => ({
      gameweek,
      points: points.total,
      counted,
      inEleven,
      rolePoints: points.role?.points ?? null,
    }));
}
