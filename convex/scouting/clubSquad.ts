import { v, type Infer } from "convex/values";
import { query } from "../_generated/server";
import { positionListFrom } from "../positions/playerPositions";
import { howPositionsCount } from "../positions/positionSettings";
import { positionRank, type Position } from "../positions/positionTables";
import { position } from "../schema";
import { memberOf } from "../shared/leagueAccess";
import { currentPlayersAt, findClubByCode } from "../shared/players";
import { MINUTES_STAT, STARTS_STAT } from "../stats/matchRecords";
import { newestSeasonWithTotals } from "../stats/seasonStats";
import { lastGameweeksTotals, periodPointsIn } from "./period";
import { onWaiversIn, ownersIn } from "./playersList";
import { currentScoutingPlayersAt, type ScoutingPlayer } from "./scoutingPlayers";
import { shownSeasonPoints } from "./shownSeasonPoints";

// A club page's Squad tab and its header's top three scorers (#1937; spec/18, Club pages, `S18.7`,
// `S18.8`, `S18.10`), in the league's own numbers, Scouting's reads (playersList.ts) reused: the
// club's current players, each with his positions, who holds him in the league, his season points
// as his card and Scouting show them (shownSeasonPoints.ts), his points in each of the last five
// finished Premier League gameweeks, the same five for every row, as Scouting's last 4 or 6 are
// (period.ts), and his season's starts and minutes. Before the season's first match, the points,
// the five gameweeks and the starts and minutes are all last season's, so a row agrees with itself
// (Craig, 12 Nov 2026). The doubt chip is the screen's greyed placeholder where FPL holds a doubt
// about him, as My Team's is, so a row carries FPL's chance he plays.

/** How many finished gameweeks a row shows his points in (`S18.8`). */
export const CLUB_FORM_GAMEWEEKS = 5;

/** How many of the club's scorers the header names (`S18.7`). */
export const TOP_SCORERS = 3;

/** The Squad tab's groups, in order, and the positions each takes: FM's split (Craig, 12 Nov 2026:
 *  "GK DEF MID AM FWD"). A player goes in the group of his first position, back to front. */
export const SQUAD_GROUPS = {
  GK: ["GK"],
  DEF: ["CB", "FB", "WB"],
  MID: ["CDM", "CM", "WM"],
  AM: ["CAM", "W"],
  FWD: ["SS", "ST"],
} as const satisfies Record<string, readonly Position[]>;
export type SquadGroup = keyof typeof SQUAD_GROUPS;
const squadGroup = v.union(...Object.keys(SQUAD_GROUPS).map((group) => v.literal(group as SquadGroup)));

/** His group: the one of his first position, back to front; null with no position, at the bottom. */
export function squadGroupOf(positions: readonly Position[]): SquadGroup | null {
  const first = positions.toSorted((one, other) => positionRank(one) - positionRank(other))[0];
  if (first === undefined) return null;
  return (Object.keys(SQUAD_GROUPS) as SquadGroup[]).find((group) => (SQUAD_GROUPS[group] as readonly Position[]).includes(first))!;
}

const squadPlayer = v.object({
  code: v.number(),
  name: v.string(),
  fullName: v.string(),
  positions: v.array(position),
  /** His group (SQUAD_GROUPS), or null with no position yet. */
  group: v.union(squadGroup, v.null()),
  /** The team in this league that owns him, or null for nobody's. */
  ownerTeamName: v.union(v.string(), v.null()),
  /** He is on the league's waivers: the row says Waivers, not Free agent. */
  onWaivers: v.boolean(),
  /** His season points as his card adds them up in this league, null ("—") with none priced. */
  seasonPoints: v.union(v.number(), v.null()),
  /** His points in each of `gameweeks`, in their order, null ("—") in one he didn't play. */
  lastGameweeks: v.array(v.union(v.number(), v.null())),
  starts: v.number(),
  minutes: v.number(),
  /** FPL's chance he plays in the next round, in percent; null while it has no doubt about him. */
  chanceOfPlaying: v.union(v.number(), v.null()),
});
export type SquadPlayer = Infer<typeof squadPlayer>;

const topScorer = v.object({ code: v.number(), name: v.string(), seasonPoints: v.number() });
export type TopScorer = Infer<typeof topScorer>;

const clubSquad = v.object({
  /** The last five finished gameweeks, oldest first: fewer while fewer have finished. */
  gameweeks: v.array(v.number()),
  /** The season the points are from while they are last season's, by the year it starts; null
   *  while they are this season's (shownSeasonPoints.ts). */
  pointsSeason: v.union(v.number(), v.null()),
  /** Every current player, by group (no position last), then position, then name. */
  players: v.array(squadPlayer),
  /** The club's top scorers, most points first, at most TOP_SCORERS. */
  topScorers: v.array(topScorer),
});
export type ClubSquad = Infer<typeof clubSquad>;

/** The club's Squad tab in the league, or null while the football sync holds no club with
 *  `clubCode` in the Premier League now. Anyone not in the league is refused. */
export const ofClub = query({
  args: { leagueId: v.id("leagues"), clubCode: v.number() },
  returns: v.union(clubSquad, v.null()),
  handler: async (ctx, { leagueId, clubCode }): Promise<ClubSquad | null> => {
    await memberOf(ctx, leagueId);
    const club = await findClubByCode(ctx, clubCode);
    if (club === null || club.droppedAt !== undefined) return null;
    const players = await currentScoutingPlayersAt(ctx, clubCode);
    const chanceOf = new Map((await currentPlayersAt(ctx, clubCode)).map((player) => [player.code, player.chanceOfPlaying ?? null]));
    const codes = players.map(({ code }) => code);
    const ownerOf = await ownersIn(ctx, leagueId);
    const onWaiversOf = await onWaiversIn(ctx, leagueId);
    const how = await howPositionsCount(ctx, leagueId);
    const { lastSeason, pointsOf } = await shownSeasonPoints(ctx, leagueId, codes);
    const season = await newestSeasonWithTotals(ctx);
    const form = await lastGameweeksTotals(ctx, CLUB_FORM_GAMEWEEKS);
    const pointsIn = await Promise.all(
      form.gameweeks.map((gameweek) => periodPointsIn(ctx, leagueId, { ...form, matches: form.matches.filter((match) => match.gameweek === gameweek) })),
    );

    const rowOf = (player: ScoutingPlayer): SquadPlayer => {
      const positions = positionListFrom(player.positions, how);
      const totals = player.totals?.season === season ? player.totals.stats : {};
      return {
        code: player.code,
        name: player.name,
        fullName: player.fullName,
        positions,
        group: squadGroupOf(positions),
        ownerTeamName: ownerOf.get(player.code) ?? null,
        onWaivers: onWaiversOf.has(player.code),
        seasonPoints: pointsOf(player.code, positions),
        lastGameweeks: pointsIn.map((of) => of(player.code, positions)),
        starts: totals[STARTS_STAT] ?? 0,
        minutes: totals[MINUTES_STAT] ?? 0,
        chanceOfPlaying: chanceOf.get(player.code) ?? null,
      };
    };
    const appearancesOf = new Map(players.map((player) => [player.code, player.totals?.season === season ? (player.totals.stats.appearances ?? 0) : 0]));
    const rows = players.map(rowOf);
    return {
      gameweeks: form.gameweeks,
      pointsSeason: lastSeason,
      players: rows.toSorted(squadOrder),
      topScorers: topScorersOf(rows, (code) => appearancesOf.get(code) ?? 0),
    };
  },
});

const groupRank = (group: SquadGroup | null) => (group === null ? Object.keys(SQUAD_GROUPS).length : Object.keys(SQUAD_GROUPS).indexOf(group));
const firstRank = (positions: readonly Position[]) => Math.min(...positions.map(positionRank), positionRank(null));

/** The Squad tab's order: by group, no position last, then by first position, then by name. */
function squadOrder(one: SquadPlayer, other: SquadPlayer): number {
  return groupRank(one.group) - groupRank(other.group) || firstRank(one.positions) - firstRank(other.positions) || one.name.localeCompare(other.name);
}

/** The TOP_SCORERS players with the most season points, a tie going to points per game (Craig, 12
 *  Nov 2026), then to the name, so the order never wavers; a player with none ("—") is left out. */
export function topScorersOf(rows: readonly SquadPlayer[], appearancesOf: (code: number) => number): TopScorer[] {
  const perGame = (row: SquadPlayer & { seasonPoints: number }) => {
    const appearances = appearancesOf(row.code);
    return appearances === 0 ? 0 : row.seasonPoints / appearances;
  };
  return rows
    .filter((row): row is SquadPlayer & { seasonPoints: number } => row.seasonPoints !== null)
    .toSorted((one, other) => other.seasonPoints - one.seasonPoints || perGame(other) - perGame(one) || one.name.localeCompare(other.name))
    .slice(0, TOP_SCORERS)
    .map(({ code, name, seasonPoints }) => ({ code, name, seasonPoints }));
}
