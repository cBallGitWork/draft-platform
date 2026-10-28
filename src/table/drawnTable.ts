// A league's table and fixtures, and one team's (My team's Fixtures tab), as the server would send
// them, for the preview and the tests: drawn by the server's pure functions
// (convex/table/roundRobin.ts, convex/table/standings.ts, convex/table/teamGames.ts), with the
// mapping copied from convex/table/leagueTable.ts's ofLeague and teamFixtures.ts's ofMyTeam.

import type { Id } from "../../convex/_generated/dataModel";
import { drawFixtures, LEAGUE_AVERAGE, roundsOf, type DrawRules } from "../../convex/table/roundRobin";
import { FIRST_RULES } from "../../convex/rules/firstRules";
import { averageOf, headToHeadTable, totalPointsTable, type GameweekScores, type TieBreak } from "../../convex/table/standings";
import { SEASON_GAMEWEEKS } from "../../convex/gameweeks/usedGameweeks";
import type { TeamFixtures } from "../../convex/table/teamFixtures";
import { BYE, gameScore, gamesOf } from "../../convex/table/teamGames";
import type { LeagueTable } from "./seam";

export type Drawn = Partial<DrawRules> & {
  /** What the order is drawn from, as the league's id is on the server. */
  seed?: string;
  format?: LeagueTable["format"];
  /** The gameweeks the league plays: all 38 by default. */
  gameweeks?: readonly number[];
  /** The league's own deadline for each gameweek: none known by default. */
  deadlineOf?: (gameweek: number) => number | null;
  scores?: GameweekScores<string>;
  /** The league's tie-breaks, in its order: a new league's by default, as the server's would be. */
  tieBreaks?: readonly TieBreak[];
  /** The teams whose scores are still provisional, and those that saved no lineup. */
  provisional?: readonly string[];
  noLineup?: readonly string[];
  unscored?: LeagueTable["unscored"];
};

const idOf = (team: string) => `id-${team}` as Id<"teams">;

/** The draw's defaults, as the server's would be for a league with no rule changed. */
const DRAW_DEFAULTS = { oddTeamOut: "leagueAverage", gamesPerGameweek: 1, seed: "preview-league", gameweeks: SEASON_GAMEWEEKS } as const;

/** The head-to-head schedule of teams with these names, as `drawn` says to draw it. */
function scheduleOf(teamNames: string[], drawn: Drawn) {
  const { oddTeamOut, gamesPerGameweek, seed, gameweeks } = { ...DRAW_DEFAULTS, ...drawn };
  return drawFixtures(teamNames, gameweeks, () => ({ oddTeamOut, gamesPerGameweek }), seed);
}

/** The league's table and fixtures for teams with these names, made in this order. */
export function leagueTableOf(teamNames: string[], drawn: Drawn = {}): LeagueTable {
  const {
    format = "headToHead",
    deadlineOf = () => null,
    scores = new Map(),
    provisional = [],
    noLineup = [],
    unscored = [],
    tieBreaks = FIRST_RULES.tieBreaks,
  } = drawn;
  const headToHead = format === "headToHead";
  const schedule = headToHead ? scheduleOf(teamNames, drawn) : [];
  const table = headToHead ? headToHeadTable(teamNames, schedule, scores, tieBreaks) : totalPointsTable(teamNames, scores);
  return {
    format,
    roundRobinRounds: schedule.length === 0 ? 0 : roundsOf(teamNames).length,
    gameweeks: schedule.map(({ gameweek, fixtures, byes }) => ({
      gameweek,
      deadline: deadlineOf(gameweek),
      fixtures: fixtures.map(({ team, opponent }) => {
        const scored = scores.get(gameweek);
        const pointsOf = (side: string) => (side === LEAGUE_AVERAGE ? averageOf(teamNames, scored!, gameweek) : scored!.get(side)!);
        return {
          teamId: idOf(team),
          team,
          opponent: opponent === LEAGUE_AVERAGE ? null : opponent,
          points: scored === undefined ? null : { team: pointsOf(team), opponent: pointsOf(opponent) },
        };
      }),
      byes,
    })),
    table: table.map(({ team, ...row }) => ({ teamId: idOf(team), teamName: team, ...row })),
    results: [...scores].map(([gameweek, scored]) => ({
      gameweek,
      teams: [...scored].map(([team, points]) => ({
        teamId: idOf(team),
        teamName: team,
        points,
        provisional: provisional.includes(team),
        noLineup: noLineup.includes(team),
      })),
    })),
    unscored,
  };
}

/** My team's fixtures for `teamName`, one of `teamNames`, in the same draw and scores as `leagueTableOf`'s. */
export function teamFixturesOf(teamNames: string[], teamName: string, drawn: Drawn = {}): TeamFixtures {
  const { format = "headToHead", deadlineOf = () => null, scores = new Map(), provisional = [], unscored = [] } = drawn;
  const schedule = format === "headToHead" ? scheduleOf(teamNames, drawn) : [];
  const games = gamesOf(schedule, teamName);
  return {
    teamId: idOf(teamName),
    teamName,
    format,
    games: games.map(({ gameweek, against }) => {
      const points = scores.get(gameweek);
      const scored = points === undefined ? undefined : new Map([...points].map(([team, each]) => [team, { points: each, provisional: provisional.includes(team) }]));
      const opponent = against.kind === "team" ? against.team : against.kind;
      return {
        gameweek,
        deadline: deadlineOf(gameweek),
        against: against.kind === "team" ? { kind: "team" as const, teamName: against.team } : against,
        score: scored === undefined || opponent === BYE ? null : gameScore(teamNames, scored, gameweek, teamName, opponent),
      };
    }),
    unscored: unscored.filter(({ gameweek }) => games.some((game) => game.gameweek === gameweek)),
  };
}
