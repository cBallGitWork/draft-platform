// A league's table and fixtures, and one team's (My team's Fixtures tab), as the server would send
// them, for the preview and the tests: the inputs ofLeague and ofMyTeam read, built here from team
// names, and handed to the server's own pure mapping (convex/table/sentTables.ts), so the preview
// and the tests draw exactly what the server sends.

import type { Id } from "../../convex/_generated/dataModel";
import { FIRST_RULES } from "../../convex/rules/firstRules";
import type { TeamFixtures } from "../../convex/table/teamFixtures";
import { leagueTableFrom, pointsOf, tableOf, teamFixturesFrom, type Results } from "../../convex/table/sentTables";
import { drawnSchedule, type Drawn } from "../shared/previewDraw";
import type { LeagueTable } from "./seam";

/** A team's id here is its name behind this, so its name reads back from it. */
const ID_PREFIX = "id-";
export const idOf = (team: string) => `${ID_PREFIX}${team}` as Id<"teams">;
const named = (teamId: Id<"teams">) => teamId.slice(ID_PREFIX.length);

/** What the server reads for teams with these names, made in this order, as `drawn` says: the
 *  format, the teams, the head-to-head schedule (none in total points), each team's points in each
 *  gameweek scored, those unscored and the deadlines. */
function inputsOf(teamNames: readonly string[], drawn: Drawn) {
  const { format = "headToHead", deadlineOf = () => null, scores = new Map(), provisional = [], unscored = [] } = drawn;
  const teamIds = teamNames.map(idOf);
  const schedule = drawnSchedule(teamIds, drawn);
  const latest = Math.max(...scores.keys());
  const results: Results = new Map(
    [...scores].map(([gameweek, scored]) => [
      gameweek,
      new Map([...scored].map(([team, points]) => [idOf(team), { points, provisional: gameweek === latest && provisional.includes(team) }])),
    ]),
  );
  return { format, teamIds, schedule, results, unscored, deadlineOf, named };
}

/** The league's table and fixtures for teams with these names, made in this order. */
export function leagueTableOf(teamNames: readonly string[], drawn: Drawn = {}): LeagueTable {
  const inputs = inputsOf(teamNames, drawn);
  const { format, teamIds, schedule, results } = inputs;
  const table = tableOf(format, teamIds, schedule, pointsOf(results), drawn.tieBreaks ?? FIRST_RULES.tieBreaks);
  return leagueTableFrom({ ...inputs, season: drawn.season ?? null, table, autoTeams: new Set((drawn.autoTeams ?? []).map(idOf)) });
}

/** My team's fixtures for `teamName`, one of `teamNames`, in the same draw and scores as `leagueTableOf`'s. */
export function teamFixturesOf(teamNames: readonly string[], teamName: string, drawn: Drawn = {}): TeamFixtures {
  return teamFixturesFrom({ ...inputsOf(teamNames, drawn), team: { id: idOf(teamName), name: teamName } });
}
