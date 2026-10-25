// League home in the preview (src/preview.ts): the Pro League's nine teams, six gameweeks scored so
// the form shows, the server's own rules picking this gameweek and the rows (glance.ts), a pinned
// letter and a few squad moves. Made up: nothing scores a matchup yet (#29).

import type { Id } from "../../convex/_generated/dataModel";
import { shownRows, thisGameweekOf } from "../../convex/home/glance";
import { SEASON_GAMEWEEKS } from "../../convex/gameweeks/usedGameweeks";
import { DAY_MS, HOUR_MS, WEEK_MS } from "../../convex/shared/time";
import { drawFixtures, LEAGUE_AVERAGE } from "../../convex/table/roundRobin";
import { formOf, headToHeadTable } from "../../convex/table/standings";
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
const current = thisGameweekOf(schedule, (gameweek) => firstDeadline + (gameweek - 1) * WEEK_MS, Date.now())!;

const home: LeagueHome = {
  format: "headToHead",
  thisGameweek: {
    gameweek: current.gameweek,
    fixtures: current.fixtures.map(({ team, opponent }) => ({ team, opponent: opponent === LEAGUE_AVERAGE ? null : opponent })),
    byes: current.byes,
  },
  table: shownRows(
    headToHeadTable(TEAMS, schedule, scores, []).map(({ team, ...row }) => ({ ...row, teamId: team })),
    MINE,
  ).map(({ teamId, position, played, won, drawn, lost, points }) => ({
    position,
    teamId: `preview-${teamId}` as Id<"teams">,
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
