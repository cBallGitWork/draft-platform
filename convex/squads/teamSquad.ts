import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { positionsNow } from "../positions/playerPositions";
import { positionRank, type Position } from "../positions/positionTables";
import { clubRecord, position } from "../schema";
import { inTenths } from "../scoring/values";
import { managerOf } from "../shared/leagueAccess";
import { clubsByCode, type Clubs } from "../shared/players";
import { begunGameweeks } from "../gameweekScorer/gameweekScores";
import { scoredMatches } from "../gameweekScorer/scoredMatches";
import { EVENT_STATS, MINUTES_STAT } from "../stats/matchRecords";
import { newestSeasonWithTotals, playerSeasonTotals } from "../stats/seasonStats";
import type { Stats } from "../stats/statTotals";
import { heldOrNot, squadOf, unheldCodes } from "./squadPlace";
import { latestRules } from "../rules/rulesHistory";

// My team's Squad tab (#364; spec/12, My team's tabs: "every player in the squad in one table,
// with his position, club, next fixture, season points and last gameweek's points"). His points
// are what his team got from him (spec/12): the matches his card shows at his slot, from the one
// place both read them (scoredMatches.ts). A match labelled not counted, or priced at his best
// position because no lineup of this team scored it, adds nothing, so the Squad tab never comes
// out above the table (Craig, 29 Oct 2026, #595). Beside them, his season's stats from the totals
// Scouting reads (seasonStats.ts), for the same season Scouting shows (#647), his club's next three
// matches, his points in the league's last five gameweeks, and FPL's news on him (Squad's approved
// picture, docs/design/approved/team-squad).

/** How many of his club's next matches a row holds (the picture's Next 3). */
export const NEXT_MATCHES_SHOWN = 3;
/** How many of the league's latest begun gameweeks his form holds. */
export const FORM_GAMEWEEKS = 5;

/** The season stats a row holds, each by the catalogue key it is kept under (statCatalogue.ts). */
export const SQUAD_STATS = {
  appearances: "appearances",
  minutes: MINUTES_STAT,
  goals: EVENT_STATS.goals,
  assists: EVENT_STATS.assists,
  cleanSheets: "clean_sheets",
  saves: "saves",
  yellowCards: EVENT_STATS.yellowCards,
  redCards: EVENT_STATS.redCards,
} as const;
type SquadStat = keyof typeof SQUAD_STATS;
const seasonStats = v.object({
  appearances: v.number(),
  minutes: v.number(),
  goals: v.number(),
  assists: v.number(),
  cleanSheets: v.number(),
  saves: v.number(),
  yellowCards: v.number(),
  redCards: v.number(),
});
export type SeasonStats = Infer<typeof seasonStats>;

/** The row's stats from his season's totals: one he has none of counts 0. */
export const squadStats = (totals: Stats): SeasonStats =>
  Object.fromEntries(Object.entries(SQUAD_STATS).map(([name, stat]) => [name, totals[stat] ?? 0])) as Record<SquadStat, number>;

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
  /** His club's next matches after `now`, soonest first, at most NEXT_MATCHES_SHOWN: none while
   *  it has none with a kickoff time. */
  nextFixtures: v.array(nextFixture),
  /** What his team got from him this season, or null ("—") while none of his matches has been
   *  priced. */
  seasonPoints: v.union(v.number(), v.null()),
  /** What his team got from him in the league's latest begun gameweek, or null ("—") while none
   *  of his matches there has been priced. */
  lastGameweekPoints: v.union(v.number(), v.null()),
  /** What his team got from him in each of the league's last FORM_GAMEWEEKS begun gameweeks,
   *  oldest first, null ("—") for one where none of his matches has been priced. */
  form: v.array(v.union(v.number(), v.null())),
  /** His season's stats, or null while no season has any totals held. */
  stats: v.union(seasonStats, v.null()),
  /** FPL's news on him, or null with none. */
  news: v.union(v.string(), v.null()),
  /** FPL's chance he plays in the next round, in percent; null while it has no doubt about him. */
  chanceOfPlaying: v.union(v.number(), v.null()),
});
export type SquadRow = Infer<typeof squadRow>;

export const teamSquad = v.object({
  teamName: v.string(),
  /** The league's latest begun gameweek, which the last gameweek's points are from; null before
   *  any has begun. */
  lastGameweek: v.union(v.number(), v.null()),
  players: v.array(squadRow),
  unheld: unheldCodes,
  /** The most players the league's rules let a squad hold; null with no limit, or no rules. */
  squadMaximum: v.union(v.number(), v.null()),
});
export type TeamSquad = Infer<typeof teamSquad>;

/** One priced match: its gameweek, its points (null while his whole record hasn't arrived), and
 *  whether his team got them: scored at his slot, not left out or priced at his best position. */
export type PricedMatch = { gameweek: number; points: number | null; counted: boolean };

/** Season and last gameweek's points from his priced matches: each the sum of those his team got,
 *  kept to tenths as the table keeps them, or null while none is priced. */
export function squadPoints(matches: readonly PricedMatch[], lastGameweek: number | null) {
  return { seasonPoints: pointsOf(matches), lastGameweekPoints: pointsOf(matches.filter(({ gameweek }) => gameweek === lastGameweek)) };
}

/** What his team got from these matches, kept to tenths, or null while none is priced. */
function pointsOf(some: readonly PricedMatch[]): number | null {
  const priced = some.filter((match): match is PricedMatch & { points: number } => match.points !== null);
  if (priced.length === 0) return null;
  return inTenths(priced.reduce((total, { points, counted }) => (counted ? total + points : total), 0));
}

/** His points in each of `begun`'s last FORM_GAMEWEEKS gameweeks, oldest first, each added up as
 *  squadPoints adds up the last gameweek's. */
export function squadForm(matches: readonly PricedMatch[], begun: readonly number[]): (number | null)[] {
  return begun.slice(-FORM_GAMEWEEKS).map((gameweek) => pointsOf(matches.filter((match) => match.gameweek === gameweek)));
}

/** Where a player's first position falls in POSITIONS, back to front; one with none goes last. */
const positionOrder = ({ positions }: Pick<SquadRow, "positions">) => positionRank(positions[0] ?? null);

/** The caller's team's squad at `now`, the screen's minute (a query may not read the clock),
 *  back to front by his first position, then by name. Refused for anyone who runs no team. */
export const ofMyTeam = query({
  args: { leagueId: v.id("leagues"), now: v.number() },
  returns: teamSquad,
  handler: async (ctx, { leagueId, now }) => {
    const { league, team } = await managerOf(ctx, leagueId);
    const positionsOfNow = await positionsNow(ctx, leagueId);
    const clubs = clubsByCode(ctx);
    const begun = await begunGameweeks(ctx, league);
    const lastGameweek = begun.at(-1) ?? null;
    const season = await newestSeasonWithTotals(ctx);
    const price = await pricer(ctx, league, team._id);
    const { held, unheld } = await heldOrNot(ctx, await squadOf(ctx, team._id));
    const players = await Promise.all(
      held.map(async ({ row: { number }, player }) => {
        const positions = await positionsOfNow(player.code);
        const stats = season === null ? null : squadStats(await playerSeasonTotals(ctx, season, player.code));
        return { player, number: number ?? null, positions, club: await clubs(player.clubCode), matches: await price(player.code, positions), stats };
      }),
    );
    const next = await nextFixturesOf(ctx, new Set(players.map(({ player }) => player.clubCode)), now, clubs);
    const rows = players.map(({ player, number, positions, club, matches, stats }) => ({
      code: player.code,
      name: player.name,
      fullName: player.fullName,
      positions,
      club,
      gone: player.droppedAt !== undefined,
      number,
      nextFixtures: next.get(player.clubCode) ?? [],
      ...squadPoints(matches, lastGameweek),
      form: squadForm(matches, begun),
      stats,
      news: player.news || null,
      chanceOfPlaying: player.chanceOfPlaying ?? null,
    }));
    rows.sort((one, other) => positionOrder(one) - positionOrder(other) || one.name.localeCompare(other.name));
    const rules = await latestRules(ctx, leagueId);
    return { teamName: team.name, lastGameweek, players: rows, unheld, squadMaximum: rules?.squad.size?.maximum ?? null };
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
 *  if it grows. Beside it the read adds one season-totals row a player and the league's rules, and
 *  reads the matches ahead until every club has three, so it grows with the squad, never the league. */
async function pricer(ctx: QueryCtx, league: Doc<"leagues">, teamId: Id<"teams">) {
  const scored = await scoredMatches(ctx, league, teamId);
  return async (code: number, positions: readonly Position[]): Promise<PricedMatch[]> =>
    (await scored.of({ code, positions })).map(({ gameweek, points, counted }) => ({ gameweek, points: points.total, counted }));
}

/** Each of these clubs' next NEXT_MATCHES_SHOWN matches after `now`, soonest first, by club code:
 *  the matches ahead are read soonest first until every club has all of them or none is left. */
async function nextFixturesOf(ctx: QueryCtx, clubCodes: ReadonlySet<number>, now: number, clubs: Clubs): Promise<Map<number, NextFixture[]>> {
  const next = new Map<number, NextFixture[]>();
  if (clubCodes.size === 0) return next;
  let full = 0;
  const ahead = ctx.db.query("fixtures").withIndex("by_droppedAt_and_kickoff", (q) => q.eq("droppedAt", undefined).gt("kickoff", now));
  for await (const fixture of ahead) {
    for (const [clubCode, opponentCode, home] of sidesOf(fixture)) {
      const held = next.get(clubCode) ?? [];
      if (!clubCodes.has(clubCode) || held.length === NEXT_MATCHES_SHOWN) continue;
      // The index reads only matches kicking off after `now`, so each has a kickoff time.
      next.set(clubCode, [...held, { gameweek: fixture.gameweek, kickoff: fixture.kickoff!, opponent: await clubs(opponentCode), home }]);
      if (held.length + 1 === NEXT_MATCHES_SHOWN) full += 1;
    }
    if (full === clubCodes.size) break;
  }
  return next;
}

/** A match from each side: the club, its opponent, and whether it is at home. */
const sidesOf = ({ homeClubCode, awayClubCode }: Doc<"fixtures">): [number, number, boolean][] => [
  [homeClubCode, awayClubCode, true],
  [awayClubCode, homeClubCode, false],
];
