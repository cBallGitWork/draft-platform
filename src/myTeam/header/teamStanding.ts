// Where a team stands in its league, read from the league's table and fixtures (convex/table/
// leagueTable.ts's LeagueTable): its place and points, its game in a gameweek, its last result and
// its form. Pure, so the tests can pin it. Form and a result are League home's own (convex/table/
// standings.ts), so the two screens never tell a team's form apart.

import { LEAGUE_AVERAGE } from "../../../convex/table/roundRobin";
import { BYE, gamesOf, type Against } from "../../../convex/table/teamGames";
import { formOf, type Result } from "../../../convex/table/standings";
import type { LeagueTable } from "../../table/seam";

/** A team's game in a gameweek: who it meets, and its score once the gameweek is scored, its own
 *  side first, and whether either side may still move. */
export type TeamGame = {
  gameweek: number;
  against: Against<string>;
  score: { team: number; opponent: number; provisional: boolean } | null;
};

export type Standing = {
  teamId: LeagueTable["table"][number]["teamId"];
  /** 1 for the top of the table. */
  place: number;
  points: number;
  /** Its last head-to-head game scored, live or final; null before any. */
  last: TeamGame | null;
  /** Its points in the latest gameweek scored, for a league in total points; null before any. */
  lastPoints: { gameweek: number; points: number; provisional: boolean } | null;
  /** Its latest results, oldest first, as League home counts them (standings.ts's formOf). */
  form: Result[];
};

/** The team's games in the league's head-to-head schedule, in gameweek order, each with its score
 *  once scored: none in total points. */
export function gamesOfTeam(table: LeagueTable, teamName: string): TeamGame[] {
  return gamesOf(scheduleOf(table), teamName).map(({ gameweek, against }) => ({ gameweek, against, score: scoreOf(table, teamName, gameweek, against) }));
}

/** The league's head-to-head schedule by team name, the league's average as the server draws it. */
const scheduleOf = (table: LeagueTable) =>
  table.gameweeks.map(({ gameweek, fixtures, byes }) => ({
    gameweek,
    fixtures: fixtures.map(({ team, opponent }) => ({ team, opponent: opponent ?? LEAGUE_AVERAGE })),
    byes,
  }));

/** The game's score from the team's side, live or final, once its gameweek is scored. */
function scoreOf(table: LeagueTable, teamName: string, gameweek: number, against: Against<string>): TeamGame["score"] {
  if (against.kind === BYE) return null;
  const fixtures = table.gameweeks.find((each) => each.gameweek === gameweek)?.fixtures ?? [];
  const opponent = against.kind === "team" ? against.team : null;
  const fixture = fixtures.find((each) => (each.team === teamName && each.opponent === opponent) || (each.team === opponent && each.opponent === teamName));
  if (fixture?.points == null) return null;
  const sides = table.results.find((each) => each.gameweek === gameweek)?.teams ?? [];
  // Live while either side may still move; against the average, while any team's may (spec/07).
  const provisional = sides.some((side) => side.provisional && (opponent === null || side.teamName === teamName || side.teamName === opponent));
  const ownSide = fixture.team === teamName;
  return { team: ownSide ? fixture.points.team : fixture.points.opponent, opponent: ownSide ? fixture.points.opponent : fixture.points.team, provisional };
}

/** The team's game in the gameweek, or null where it plays none (total points, or a gameweek
 *  drawn before it joined). */
export const gameIn = (table: LeagueTable, teamName: string, gameweek: number): TeamGame | null =>
  gamesOfTeam(table, teamName).find((game) => game.gameweek === gameweek) ?? null;

/** Where the team stands, or null for one the table doesn't hold. */
export function standingOf(table: LeagueTable, teamName: string): Standing | null {
  const index = table.table.findIndex((row) => row.teamName === teamName);
  if (index === -1) return null;
  const row = table.table[index];
  const scored = gamesOfTeam(table, teamName).filter((game): game is TeamGame & { score: NonNullable<TeamGame["score"]> } => game.score !== null);
  const latest = table.results.findLast((result) => result.teams.some((side) => side.teamName === teamName));
  const own = latest?.teams.find((side) => side.teamName === teamName);
  return {
    teamId: row.teamId,
    place: index + 1,
    points: row.points,
    last: scored.at(-1) ?? null,
    lastPoints: latest === undefined || own === undefined ? null : { gameweek: latest.gameweek, points: own.points, provisional: own.provisional },
    form: formOf(
      table.table.map(({ teamName: name }) => name),
      scheduleOf(table),
      new Map(table.results.map(({ gameweek, teams }) => [gameweek, new Map(teams.map((side) => [side.teamName, side.points]))])),
    ).get(teamName)!,
  };
}
