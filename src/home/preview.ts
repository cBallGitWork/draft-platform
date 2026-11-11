// League home in the preview (src/app/preview.ts): the Pro League's nine teams, six gameweeks scored so
// the form shows, the server's own rules picking this gameweek (nextGameweek.ts) and the rows
// (glance.ts), its head-to-heads scored, a matchday open with a few Vidiprinter lines, a pinned
// letter, a few squad moves, the News tab's two pages of them and the last gameweek's recap. Made up.

import { shownRows } from "../../convex/home/glance";
import { thisGameweekOf } from "../../convex/gameweeks/nextGameweek";
import { seasonGameweeks } from "../../convex/gameweeks/usedGameweeks";
import { DAY_MS, HOUR_MS, WEEK_MS } from "../../convex/shared/time";
import { drawFixtures, namedFixture } from "../../convex/table/roundRobin";
import { formOf, headToHeadTable, teamsInGameweek } from "../../convex/table/standings";
import { gameNumberAt, gameScore } from "../../convex/table/teamGames";
import { previewLatestMail } from "../mail/preview";
import { previewSeasonGameweeks } from "../shared/preview";
import { previewIdOf } from "../table/preview";
import type { Id } from "../../convex/_generated/dataModel";
import type { HomeSeam, LeagueHome, LeagueNews, NewsAsked, NewsMove } from "./seam";

/** A trade that went through (#1491): Lingard Franca's Watkins for Expected Toulouse's Rogers and
 *  Isak, made up. */
const TRADED = {
  at: Date.now() - 10 * HOUR_MS,
  kind: "tradeMade",
  fromTeamName: "Lingard Franca",
  toTeamName: "Expected Toulouse",
  gives: { players: [{ playerCode: 9001, playerName: "Watkins" }], picks: [] },
  gets: {
    players: [
      { playerCode: 9002, playerName: "Rogers" },
      { playerCode: 9003, playerName: "Isak" },
    ],
    picks: [],
  },
} as const satisfies LeagueHome["squadMoves"][number];

const TEAMS = ["Saka Potatoes", "Kroos Control", "Lingard Franca", "Neville Wears Prada", "Team 5", "Murder on Zidane's Floor", "Dinamo Kiev Leave", "Haaland Oates", "Expected Toulouse"];
const MINE = "Saka Potatoes";
const SCORED = 6;
/** The gameweek whose recap the preview has: the last one scored. */
export const PREVIEW_RECAP_GAMEWEEK = SCORED;
const firstDeadline = Date.now() - SCORED * WEEK_MS + DAY_MS;

const schedule = drawFixtures(TEAMS, seasonGameweeks(previewSeasonGameweeks), () => ({ oddTeamOut: "leagueAverage", gamesPerGameweek: 1 }), "preview-home");
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
    fixtures: current.fixtures.map((each, index) => {
      const scored = sides.get(current.gameweek);
      const score = scored === undefined ? null : gameScore(teamsInGameweek(current), scored, current.gameweek, each.team, each.opponent);
      return { teamId: previewIdOf(each.team), game: gameNumberAt(current.fixtures, index), ...namedFixture(each, (name) => name), points: score && { team: score.team, opponent: score.opponent } };
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
    TRADED,
    { at: Date.now() - DAY_MS, kind: "playerMoved", playerName: "Palmer", teamName: "Kroos Control", fromTeamName: "Haaland Oates" },
    { at: Date.now() - 3 * DAY_MS, kind: "playerReleased", playerName: "Rice", teamName: "Lingard Franca", fromTeamName: null },
  ],
  pinnedLetter: {
    at: Date.now() - 5 * HOUR_MS,
    from: "commish@example.com",
    subject: "The trophy is up for grabs",
    body: "Last season's winner keeps it on his mantelpiece.\nFirst to the top by Christmas gets a pint from me.",
  },
  recap: {
    gameweek: SCORED,
    writtenAt: Date.now() - 2 * DAY_MS,
    changedTeamId: null,
    text: `Saka Potatoes edged Kroos Control in the game of Gameweek ${SCORED}, while Haaland Oates ran away with the week's top score. Haaland led the performers with 18 for Haaland Oates, ahead of Saka's 15 and Palmer's 12. Rice managed only 1 for Lingard Franca. Expected Toulouse left 14 on the bench, the most of anyone.`,
  },
};

/** The News tab's moves (#1356), made up: a page of the newest, and one older page behind it. */
type PlayerNewsMove = Exclude<NewsMove, { kind: "tradeMade" }>;
const newsMove = (hoursAgo: number, kind: PlayerNewsMove["kind"], team: string, joined: string | null, left: string | null, rest: Partial<PlayerNewsMove> = {}): NewsMove => {
  const at = Date.now() - hoursAgo * HOUR_MS;
  const player = (name: string | null) => (name === null ? null : { playerCode: name.length * 1000 + hoursAgo, playerName: name });
  return { at, filed: at, kind, teamId: previewIdOf(team), teamName: team, joined: player(joined), left: player(left), toWaivers: null, fromTeamId: null, fromTeamName: null, ...rest };
};
const TRADE: NewsMove = {
  at: TRADED.at,
  filed: TRADED.at,
  kind: TRADED.kind,
  gives: TRADED.gives,
  gets: TRADED.gets,
  teamId: previewIdOf(TRADED.fromTeamName),
  teamName: TRADED.fromTeamName,
  otherTeamId: previewIdOf(TRADED.toTeamName),
  otherTeamName: TRADED.toTeamName,
};
const namesTeam = (move: NewsMove, teamId: Id<"teams">) => move.teamId === teamId || (move.kind === "tradeMade" ? move.otherTeamId : move.fromTeamId) === teamId;
const NEWS_MOVES: NewsMove[] = [
  newsMove(3, "playerDropped", "Kroos Control", null, "Kudus", { toWaivers: true }),
  TRADE,
  newsMove(20, "playerClaimed", MINE, "Mbeumo", "Livramento", { toWaivers: true }),
  newsMove(30, "playerMoved", "Haaland Oates", "Konsa", null, { fromTeamId: previewIdOf(MINE), fromTeamName: MINE }),
  newsMove(50, "playerPickedUp", "Lingard Franca", "Calvert-Lewin", "Kamara", { toWaivers: false }),
  newsMove(70, "playerAssigned", "Team 5", "Wissa", null),
  newsMove(90, "playerReleased", "Expected Toulouse", null, "Minteh"),
];
const OLDER_NEWS: NewsMove[] = [newsMove(200, "playerAssigned", "Dinamo Kiev Leave", "Eze", null), newsMove(220, "playerAssigned", MINE, "Saka", null)];
const news = (before: NewsAsked["before"]): LeagueNews => {
  const moves = before === null ? NEWS_MOVES : OLDER_NEWS;
  const last = moves.at(-1)!;
  return {
    moves,
    older: before === null ? { at: last.at, filed: last.filed } : null,
    teams: TEAMS.map((team) => ({ teamId: previewIdOf(team), teamName: team })),
    pinnedLetter: home.pinnedLetter,
  };
};

export const previewHome: HomeSeam = {
  useLeagueHome: () => home,
  useLatestMail: () => previewLatestMail,
  useRecap: (_, gameweek) => (gameweek === SCORED ? home.recap : null),
  useLeagueNews: (_, { before, teamId, kind }) => {
    const page = news(before);
    return { ...page, moves: page.moves.filter((move) => (teamId === null || namesTeam(move, teamId)) && (kind === null || move.kind === kind)) };
  },
};
