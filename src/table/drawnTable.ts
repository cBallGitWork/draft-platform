// A league's table and fixtures as the server would send them, drawn by the server's own pure
// functions: for the preview and the tests.

import type { Id } from "../../convex/_generated/dataModel";
import { drawFixtures, LEAGUE_AVERAGE, roundsOf, type OddTeamOut } from "../../convex/roundRobin";
import { headToHeadTable, totalPointsTable, type GameweekScores } from "../../convex/standings";
import { SEASON_GAMEWEEKS } from "../../convex/usedGameweeks";
import type { LeagueTable } from "./seam";

type Drawn = {
  format?: LeagueTable["format"];
  oddTeamOut?: OddTeamOut;
  /** The gameweeks the league plays: all 38 by default. */
  gameweeks?: readonly number[];
  /** FPL's deadline for each gameweek: none known by default. */
  deadlineOf?: (gameweek: number) => number | null;
  scores?: GameweekScores<string>;
};

/** The league's table and fixtures for teams with these names, made in this order. */
export function leagueTableOf(
  teamNames: string[],
  {
    format = "headToHead",
    oddTeamOut = "leagueAverage",
    gameweeks = SEASON_GAMEWEEKS,
    deadlineOf = () => null,
    scores = new Map(),
  }: Drawn = {},
): LeagueTable {
  const headToHead = format === "headToHead";
  const schedule = headToHead ? drawFixtures(teamNames, gameweeks, oddTeamOut) : [];
  const table = headToHead ? headToHeadTable(teamNames, schedule, scores, []) : totalPointsTable(teamNames, scores);
  return {
    format,
    roundRobinGameweeks: schedule.length === 0 ? 0 : roundsOf(teamNames).length,
    gameweeks: schedule.map(({ gameweek, fixtures, bye }) => ({
      gameweek,
      deadline: deadlineOf(gameweek),
      fixtures: fixtures.map(({ team, opponent }) => ({ team, opponent: opponent === LEAGUE_AVERAGE ? null : opponent })),
      bye,
    })),
    table: table.map(({ team, ...row }) => ({ teamId: `id-${team}` as Id<"teams">, teamName: team, ...row })),
  };
}
