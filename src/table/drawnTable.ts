// A league's table and fixtures as the server would send them, for the preview and the tests:
// drawn by the server's pure functions (convex/table/roundRobin.ts, convex/table/standings.ts), with the
// mapping copied from convex/table/leagueTable.ts's ofLeague, and with no tie-breaks.

import type { Id } from "../../convex/_generated/dataModel";
import { drawFixtures, LEAGUE_AVERAGE, roundsOf, type DrawRules } from "../../convex/table/roundRobin";
import { headToHeadTable, totalPointsTable, type GameweekScores } from "../../convex/table/standings";
import { SEASON_GAMEWEEKS } from "../../convex/gameweeks/usedGameweeks";
import type { LeagueTable } from "./seam";

type Drawn = Partial<DrawRules> & {
  /** What the order is drawn from, as the league's id is on the server. */
  seed?: string;
  format?: LeagueTable["format"];
  /** The gameweeks the league plays: all 38 by default. */
  gameweeks?: readonly number[];
  /** The league's own deadline for each gameweek: none known by default. */
  deadlineOf?: (gameweek: number) => number | null;
  scores?: GameweekScores<string>;
};

/** The league's table and fixtures for teams with these names, made in this order. */
export function leagueTableOf(
  teamNames: string[],
  {
    format = "headToHead",
    oddTeamOut = "leagueAverage",
    gamesPerGameweek = 1,
    seed = "preview-league",
    gameweeks = SEASON_GAMEWEEKS,
    deadlineOf = () => null,
    scores = new Map(),
  }: Drawn = {},
): LeagueTable {
  const headToHead = format === "headToHead";
  const schedule = headToHead ? drawFixtures(teamNames, gameweeks, () => ({ oddTeamOut, gamesPerGameweek }), seed) : [];
  const table = headToHead ? headToHeadTable(teamNames, schedule, scores, []) : totalPointsTable(teamNames, scores);
  return {
    format,
    roundRobinRounds: schedule.length === 0 ? 0 : roundsOf(teamNames).length,
    gameweeks: schedule.map(({ gameweek, fixtures, byes }) => ({
      gameweek,
      deadline: deadlineOf(gameweek),
      fixtures: fixtures.map(({ team, opponent }) => ({ team, opponent: opponent === LEAGUE_AVERAGE ? null : opponent })),
      byes,
    })),
    table: table.map(({ team, ...row }) => ({ teamId: `id-${team}` as Id<"teams">, teamName: team, ...row })),
  };
}
