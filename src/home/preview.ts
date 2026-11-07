// League home in the preview (src/app/preview.ts): the Pro League's nine teams, six gameweeks scored so
// the form shows, the server's own rules picking this gameweek (nextGameweek.ts) and the rows
// (glance.ts), its head-to-heads scored, a matchday open with a few Vidiprinter lines, a pinned
// letter and a few squad moves. Made up.

import { shownRows } from "../../convex/home/glance";
import { thisGameweekOf } from "../../convex/gameweeks/nextGameweek";
import { SEASON_GAMEWEEKS } from "../../convex/gameweeks/usedGameweeks";
import { DAY_MS, HOUR_MS, WEEK_MS } from "../../convex/shared/time";
import { drawFixtures, namedFixture } from "../../convex/table/roundRobin";
import { formOf, headToHeadTable, teamsInGameweek } from "../../convex/table/standings";
import { gameScore } from "../../convex/table/teamGames";
import { previewIdOf } from "../table/preview";
import type { HomeSeam, LeagueHome } from "./seam";

const TEAMS = ["Saka Potatoes", "Kroos Control", "Lingard Franca", "Neville Wears Prada", "Team 5", "Murder on Zidane's Floor", "Dinamo Kiev Leave", "Haaland Oates", "Expected Toulouse"];
const MINE = "Saka Potatoes";
const SCORED = 6;
const firstDeadline = Date.now() - SCORED * WEEK_MS + DAY_MS;

const schedule = drawFixtures(TEAMS, SEASON_GAMEWEEKS, () => ({ oddTeamOut: "leagueAverage", gamesPerGameweek: 1 }), "preview-home");
/** Made-up scores: each team's points a gameweek, from its place in TEAMS and the gameweek. */
const scores = new Map(
  Array.from({ length: SCORED }, (_, i) => [i + 1, new Map(TEAMS.map((team, place) => [team, 30 + ((place * 7 + (i + 1) * 13) % 40)]))]),
);
const form = formOf(TEAMS, schedule, scores);
/** The same scores, each final, as the head-to-heads read them. */
const sides = new Map([...scores].map(([gameweek, teams]) => [gameweek, new Map([...teams].map(([team, points]) => [team, { points, provisional: false }]))]));
const current = thisGameweekOf(schedule, (gameweek) => firstDeadline + (gameweek - 1) * WEEK_MS, Date.now())!;

const home: LeagueHome = {
  format: "headToHead",
  thisGameweek: {
    gameweek: current.gameweek,
    fixtures: current.fixtures.map((each) => {
      const scored = sides.get(current.gameweek);
      const score = scored === undefined ? null : gameScore(teamsInGameweek(current), scored, current.gameweek, each.team, each.opponent);
      return { teamId: previewIdOf(each.team), ...namedFixture(each, (name) => name), points: score && { team: score.team, opponent: score.opponent } };
    }),
    byes: current.byes,
  },
  // A matchday open, its lines made up.
  matchday: {
    gameweek: current.gameweek,
    commentary: {
      kind: "read",
      delayed: false,
      lines: [
        { key: "3", text: "78' GOAL Haaland", points: "+9" },
        { key: "2", text: "71' YELLOW Rice", points: "−1" },
        { key: "1", text: "52' GOAL Saka", points: "Saka +5, Palmer +3" },
      ],
    },
  },
  table: shownRows(
    headToHeadTable(TEAMS, schedule, scores, []).map(({ team, ...row }) => ({ ...row, teamId: team })),
    MINE,
  ).map(({ teamId, position, played, won, drawn, lost, points }) => ({
    position,
    teamId: previewIdOf(teamId),
    teamName: teamId,
    played,
    won,
    drawn,
    lost,
    points,
    form: form.get(teamId)!,
    mine: teamId === MINE,
  })),
  teams: TEAMS.length,
  squadMoves: [
    { at: Date.now() - 2 * HOUR_MS, kind: "playerAssigned", playerName: "Saka", teamName: MINE, fromTeamName: null },
    { at: Date.now() - DAY_MS, kind: "playerMoved", playerName: "Palmer", teamName: "Kroos Control", fromTeamName: "Haaland Oates" },
    { at: Date.now() - 3 * DAY_MS, kind: "playerReleased", playerName: "Rice", teamName: "Lingard Franca", fromTeamName: null },
  ],
  pinnedLetter: {
    at: Date.now() - 5 * HOUR_MS,
    from: "commish@example.com",
    subject: "The trophy is up for grabs",
    body: "Last season's winner keeps it on his mantelpiece.\nFirst to the top by Christmas gets a pint from me.",
  },
};

export const previewHome: HomeSeam = { useLeagueHome: () => home };
