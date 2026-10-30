// A league's table and fixtures, and one team's (My team's Fixtures tab), as the server would send
// them, for the preview and the tests: the inputs ofLeague and ofMyTeam read, built here from team
// names, and handed to the server's own pure mapping (convex/table/sentTables.ts), so the preview
// and the tests draw exactly what the server sends.

import type { Id } from "../../convex/_generated/dataModel";
import { drawFixtures, type DrawRules } from "../../convex/table/roundRobin";
import { FIRST_RULES } from "../../convex/rules/firstRules";
import type { GameweekScores, TieBreak } from "../../convex/table/standings";
import type { DeadlineOf } from "../../convex/gameweeks/deadline";
import { SEASON_GAMEWEEKS } from "../../convex/gameweeks/usedGameweeks";
import type { TeamFixtures } from "../../convex/table/teamFixtures";
import { leagueTableFrom, pointsOf, tableOf, teamFixturesFrom, type Results } from "../../convex/table/sentTables";
import type { LeagueTable } from "./seam";

export type Drawn = Partial<DrawRules> & {
  /** What the order is drawn from, as the league's id is on the server. */
  seed?: string;
  format?: LeagueTable["format"];
  /** The gameweeks the league plays: all 38 by default. */
  gameweeks?: readonly number[];
  /** The league's own deadline for each gameweek: none known by default. */
  deadlineOf?: DeadlineOf;
  scores?: GameweekScores<string>;
  /** The league's tie-breaks, in its order: a new league's by default, as the server's would be. */
  tieBreaks?: readonly TieBreak[];
  /** The teams whose scores are still provisional, and those that saved no lineup. */
  provisional?: readonly string[];
  noLineup?: readonly string[];
  unscored?: LeagueTable["unscored"];
};

/** A team's id here is its name behind this, so its name reads back from it. */
const ID_PREFIX = "id-";
export const idOf = (team: string) => `${ID_PREFIX}${team}` as Id<"teams">;
const named = (teamId: Id<"teams">) => teamId.slice(ID_PREFIX.length);

/** The draw's defaults, as the server's would be for a league with no rule changed. */
const DRAW_DEFAULTS = { oddTeamOut: "leagueAverage", gamesPerGameweek: 1, seed: "preview-league", gameweeks: SEASON_GAMEWEEKS } as const;

/** What the server reads for teams with these names, made in this order, as `drawn` says: the
 *  format, the teams, the head-to-head schedule (none in total points), each team's points in each
 *  gameweek scored, those unscored and the deadlines. */
function inputsOf(teamNames: string[], drawn: Drawn) {
  const { oddTeamOut, gamesPerGameweek, seed, gameweeks } = { ...DRAW_DEFAULTS, ...drawn };
  const { format = "headToHead", deadlineOf = () => null, scores = new Map(), provisional = [], noLineup = [], unscored = [] } = drawn;
  const teamIds = teamNames.map(idOf);
  const schedule = format === "headToHead" ? drawFixtures(teamIds, gameweeks, () => ({ oddTeamOut, gamesPerGameweek }), seed) : [];
  const results: Results = new Map(
    [...scores].map(([gameweek, scored]) => [
      gameweek,
      new Map([...scored].map(([team, points]) => [idOf(team), { points, provisional: provisional.includes(team), noLineup: noLineup.includes(team) }])),
    ]),
  );
  return { format, teamIds, schedule, results, unscored, deadlineOf, named };
}

/** The league's table and fixtures for teams with these names, made in this order. */
export function leagueTableOf(teamNames: string[], drawn: Drawn = {}): LeagueTable {
  const inputs = inputsOf(teamNames, drawn);
  const { format, teamIds, schedule, results } = inputs;
  const table = tableOf(format, teamIds, schedule, pointsOf(results), drawn.tieBreaks ?? FIRST_RULES.tieBreaks);
  return leagueTableFrom({ ...inputs, table });
}

/** My team's fixtures for `teamName`, one of `teamNames`, in the same draw and scores as `leagueTableOf`'s. */
export function teamFixturesOf(teamNames: string[], teamName: string, drawn: Drawn = {}): TeamFixtures {
  return teamFixturesFrom({ ...inputsOf(teamNames, drawn), team: { id: idOf(teamName), name: teamName } });
}
