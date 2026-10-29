import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { clubsByCode, type Clubs } from "../playerCard/playerCard";
import { currentPositions } from "../positions/playerPositions";
import { howPositionsCount } from "../positions/positionSettings";
import { POSITIONS, type Position } from "../positions/positionTables";
import { clubRecord, position } from "../schema";
import { inTenths } from "../scoring/scoringSet";
import { managerOf } from "../shared/leagueAccess";
import { playerByCode } from "../shared/players";
import { begunGameweeks } from "../gameweekScorer/gameweekScores";
import { scoredMatches } from "../gameweekScorer/scoredMatches";
import { squadOf } from "./squads";

// My team's Squad tab (#364; spec/12, My team's tabs: "every player in the squad in one table,
// with his position, club, next fixture, season points and last gameweek's points"). His points
// are what his team got from him (spec/12): the matches his card shows at his slot, from the one
// place both read them (scoredMatches.ts). A match labelled not counted, or priced at his best
// position because no lineup of this team scored it, adds nothing, so the Squad tab never comes
// out above the table (Craig, 29 Oct 2026, #595).

const nextFixture = v.object({
  gameweek: v.union(v.number(), v.null()),
  kickoff: v.number(),
  opponent: clubRecord,
  home: v.boolean(),
});
type NextFixture = Infer<typeof nextFixture>;

const squadRow = v.object({
  code: v.number(),
  name: v.string(),
  fullName: v.string(),
  positions: v.array(position),
  club: clubRecord,
  /** Left the Premier League: he stays on the team until released. */
  gone: v.boolean(),
  /** The squad number his manager gave him, or null until given (#13). */
  number: v.union(v.number(), v.null()),
  /** His club's next match after `now`, or null while it has none with a kickoff time. */
  nextFixture: v.union(nextFixture, v.null()),
  /** What his team got from him this season, or null ("—") while none of his matches has been
   *  priced. */
  seasonPoints: v.union(v.number(), v.null()),
  /** What his team got from him in the league's latest begun gameweek, or null ("—") while none
   *  of his matches there has been priced. */
  lastGameweekPoints: v.union(v.number(), v.null()),
});
export type SquadRow = Infer<typeof squadRow>;

export const teamSquad = v.object({
  teamName: v.string(),
  /** The league's latest begun gameweek, which the last gameweek's points are from; null before
   *  any has begun. */
  lastGameweek: v.union(v.number(), v.null()),
  players: v.array(squadRow),
});
export type TeamSquad = Infer<typeof teamSquad>;

/** One priced match: its gameweek, its points (null while his whole record hasn't arrived), and
 *  whether his team got them: scored at his slot, not labelled not counted or at his best position. */
export type PricedMatch = { gameweek: number; points: number | null; counted: boolean };

/** Season and last gameweek's points from his priced matches: each the sum of those his team got,
 *  kept to tenths as the table keeps them, or null while none is priced. */
export function squadPoints(matches: readonly PricedMatch[], lastGameweek: number | null) {
  const sum = (some: readonly PricedMatch[]) => {
    const priced = some.filter((match): match is PricedMatch & { points: number } => match.points !== null);
    if (priced.length === 0) return null;
    return inTenths(priced.reduce((total, { points, counted }) => (counted ? total + points : total), 0));
  };
  return { seasonPoints: sum(matches), lastGameweekPoints: sum(matches.filter(({ gameweek }) => gameweek === lastGameweek)) };
}

/** Where a player's first position falls in POSITIONS, back to front; one with none goes last. */
const positionOrder = ({ positions }: Pick<SquadRow, "positions">) => (positions.length === 0 ? POSITIONS.length : POSITIONS.indexOf(positions[0]));

/** The caller's team's squad at `now`, the screen's minute (a query may not read the clock),
 *  back to front by his first position, then by name. Refused for anyone who runs no team. */
export const ofMyTeam = query({
  args: { leagueId: v.id("leagues"), now: v.number() },
  returns: teamSquad,
  handler: async (ctx, { leagueId, now }) => {
    const { league, team } = await managerOf(ctx, leagueId);
    const how = await howPositionsCount(ctx);
    const clubs = clubsByCode(ctx);
    const lastGameweek = (await begunGameweeks(ctx, league)).at(-1) ?? null;
    const price = await pricer(ctx, league, team._id);
    const players = await Promise.all(
      (await squadOf(ctx, team._id)).map(async ({ playerCode, number }) => {
        const player = await playerByCode(ctx, playerCode);
        if (player === null) throw new Error(`Player ${playerCode} is in team ${team._id}'s squad but the football sync doesn't hold him`);
        const positions = await currentPositions(ctx, playerCode, how);
        return { player, number: number ?? null, positions, club: await clubs(player.clubCode), matches: await price(player.code, positions) };
      }),
    );
    const next = await nextFixturesOf(ctx, new Set(players.map(({ player }) => player.clubCode)), now, clubs);
    const rows = players.map(({ player, number, positions, club, matches }) => ({
      code: player.code,
      name: player.name,
      fullName: player.fullName,
      positions,
      club,
      gone: player.droppedAt !== undefined,
      number,
      nextFixture: next.get(player.clubCode) ?? null,
      ...squadPoints(matches, lastGameweek),
    }));
    rows.sort((one, other) => positionOrder(one) - positionOrder(other) || one.name.localeCompare(other.name));
    return { teamName: team.name, lastGameweek, players: rows };
  },
});

/** Prices a player's season's matches as his card does (scoredMatches.ts): each match's total,
 *  the league's override where it holds one, and whether it was scored at his slot.
 *
 *  What a full squad costs: each player's records and their matches (about 25 x 2 x the gameweeks
 *  played) and his overrides in the league, and each gameweek begun, read once for the team: its
 *  lineup, which reads the league's squad moves since that gameweek's deadline (lineups.ts), each
 *  match's state, and the records of the men in the lineup. Inside a query's limits for a season of
 *  an ordinary league; past SQUAD_MOVES_READ_MOST moves of a kind it throws rather than mis-price.
 *  Storing a gameweek's priced matches once final, as finalScores.ts does the totals, is the way on
 *  if it grows. */
async function pricer(ctx: QueryCtx, league: Doc<"leagues">, teamId: Id<"teams">) {
  const scored = await scoredMatches(ctx, league, teamId);
  return async (code: number, positions: readonly Position[]): Promise<PricedMatch[]> =>
    (await scored.of({ code, positions })).map(({ gameweek, points, counted }) => ({ gameweek, points: points.total, counted }));
}

/** Each of these clubs' next match after `now`, by club code: the matches ahead are read soonest
 *  first until every club has one or none is left. */
async function nextFixturesOf(ctx: QueryCtx, clubCodes: ReadonlySet<number>, now: number, clubs: Clubs): Promise<Map<number, NextFixture>> {
  const next = new Map<number, NextFixture>();
  if (clubCodes.size === 0) return next;
  const ahead = ctx.db.query("fixtures").withIndex("by_droppedAt_and_kickoff", (q) => q.eq("droppedAt", undefined).gt("kickoff", now));
  for await (const fixture of ahead) {
    for (const [clubCode, opponentCode, home] of sidesOf(fixture)) {
      if (!clubCodes.has(clubCode) || next.has(clubCode)) continue;
      // The index reads only matches kicking off after `now`, so each has a kickoff time.
      next.set(clubCode, { gameweek: fixture.gameweek, kickoff: fixture.kickoff!, opponent: await clubs(opponentCode), home });
    }
    if (next.size === clubCodes.size) break;
  }
  return next;
}

/** A match from each side: the club, its opponent, and whether it is at home. */
const sidesOf = ({ homeClubCode, awayClubCode }: Doc<"fixtures">): [number, number, boolean][] => [
  [homeClubCode, awayClubCode, true],
  [awayClubCode, homeClubCode, false],
];
