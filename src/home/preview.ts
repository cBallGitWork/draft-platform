// League home in the preview (src/app/preview.ts): the Pro League's nine teams, its table, fixtures
// and scores the table preview's (src/table/preview.ts) so the two screens agree, the server's own
// rules picking this gameweek (nextGameweek.ts) and the rows (glance.ts), its head-to-heads scored, a
// matchday open with the matchup's Vidiprinter lines, a pinned letter, a few squad moves, the News
// tab's two pages of them and the last finished gameweek's recap, its men's points their cards'.
// Made up.

import { shownRows } from "../../convex/home/glance";
import { thisGameweekOf } from "../../convex/gameweeks/nextGameweek";
import { gameModeOf } from "../../convex/rules/gameMode";
import { DAY_MS, HOUR_MS } from "../../convex/shared/time";
import { namedFixture } from "../../convex/table/roundRobin";
import { formOf, teamsInGameweek } from "../../convex/table/standings";
import { gameNumberAt, gameScore } from "../../convex/table/teamGames";
import { FIRST_RULES } from "../../convex/rules/firstRules";
import { previewLatestMail } from "../mail/preview";
import { previewChanceOf, previewSquad, previewStarterCodes } from "../myTeam/tactics/preview";
import { previewGameweek, previewTeamNames } from "../shared/preview";
import { previewIdOf, previewLeagueTable, previewOpponent, previewOpponentOf, previewSchedule, previewScored } from "../table/preview";
import { previewMatchdayLines } from "../matchup/preview";
import { previewSeasonOf } from "../playerCard/preview";
import { RECAP_PLAYERS } from "../../convex/home/recapWords";
import { previewPlayers, previewRivals } from "../scouting/preview";
import { playsIn, previewClubMatch, previewGameweekMatches } from "../premierLeague/preview";
import { flaggedStartersAt } from "../../convex/home/homeAt";
import type { Id } from "../../convex/_generated/dataModel";
import type { HomeSeam, LeagueHome, LeagueNews, NewsAsked, NewsMove } from "./seam";

/** A trade that went through (#1491): Lingard Franca's Strand Larsen for Expected Toulouse's Neto
 *  and Ouattara, none of them a man another screen places, made up. */
const TRADED = {
  at: Date.now() - 10 * HOUR_MS,
  kind: "tradeMade",
  fromTeamName: "Lingard Franca",
  toTeamName: "Expected Toulouse",
  gives: { players: [{ playerCode: 9001, playerName: "Strand Larsen" }], picks: [] },
  gets: {
    players: [
      { playerCode: 9002, playerName: "Neto" },
      { playerCode: 9003, playerName: "Ouattara" },
    ],
    picks: [],
  },
} as const satisfies LeagueHome["squadMoves"][number];

const [MINE] = previewTeamNames;
/** The gameweek whose recap the preview has: the last one over, the one before Football's live
 *  gameweek (#2466). */
const SCORED = previewGameweek - 1;
export const PREVIEW_RECAP_GAMEWEEK = SCORED;

/** The table preview's fixtures and scores, so League home and the table agree (#1969). */
const schedule = previewSchedule;
const { scores, provisional, deadlineOf } = previewScored;
/** The preview league plays head-to-head. */
const mode = gameModeOf({ format: "headToHead" });
const form = formOf(mode, previewTeamNames, schedule, scores);
/** The same scores, as the head-to-heads read them. */
const sides = new Map([...scores].map(([gameweek, teams]) => [gameweek, new Map([...teams].map(([team, points]) => [team, { points, provisional: provisional.includes(team) }]))]));
const current = thisGameweekOf(schedule, deadlineOf, Date.now())!;
const deadline = deadlineOf(current.gameweek);

/** The reader's own panels (#1976): Tactics' squad, its news and its lineup, made-up claims, and
 *  Football's matches this gameweek with one of his players or his opponent's, Scouting's, by the
 *  server's rule (yourGameweek.ts; #2450, #2455). */
const squadNews = previewSquad.flatMap(({ playerCode, name, news }) => (news === null ? [] : [{ playerCode, name, news, chanceOfPlaying: previewChanceOf(playerCode) }]));
const startersOf = new Set(previewStarterCodes);
/** Its flagged starters, each with his club's Football match this gameweek, which leaves him out of
 *  Your lineup once it has kicked off, as the server's (#2466). */
const flaggedStarters = previewSquad.flatMap(({ playerCode, clubCode }) => {
  const news = squadNews.find((each) => each.playerCode === playerCode);
  return news === undefined || !startersOf.has(playerCode) ? [] : [{ ...news, kickoff: previewClubMatch(current.gameweek, clubCode)?.kickoff ?? null }];
});
const theirs = previewPlayers.filter(({ ownerTeamName }) => ownerTeamName === previewOpponent);
const premierLeague = previewGameweekMatches(current.gameweek)
  .map(({ fixtureCode, kickoff, home, away }) => ({
    fixtureCode,
    kickoff,
    home,
    away,
    you: previewSquad.filter(({ clubCode }) => playsIn(clubCode, { home, away })).map(({ name }) => name),
    them: theirs.filter(({ club }) => playsIn(club.code, { home, away })).map(({ name }) => name),
  }))
  .filter(({ you, them }) => you.length > 0 || them.length > 0)
  .toSorted((one, other) => (one.kickoff ?? 0) - (other.kickoff ?? 0));
const yours: LeagueHome["yours"] = {
  squadNews,
  lineup: { set: true, flagged: flaggedStartersAt(flaggedStarters, Date.now()) },
  waiverRuns: FIRST_RULES.waivers.runs,
  claims: 2,
  premierLeague,
};

const home: LeagueHome = {
  format: "headToHead",
  thisGameweek: {
    gameweek: current.gameweek,
    fixtures: current.fixtures.map((each, index) => {
      const scored = sides.get(current.gameweek);
      const score = scored === undefined ? null : gameScore(teamsInGameweek(current), scored, current.gameweek, each.team, each.opponent);
      return { teamId: previewIdOf(each.team), game: gameNumberAt(current.fixtures, index), ...namedFixture(each, (name) => name), points: score };
    }),
    byes: current.byes,
  },
  deadline,
  yours,
  // A matchday open, its lines the matchup's as Football's gameweek stands (#2466).
  matchday: { gameweek: current.gameweek, commentary: previewMatchdayLines(current.gameweek) },
  table: shownRows(
    previewLeagueTable.table.map(({ teamName, ...row }) => ({ ...row, teamId: teamName })),
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
  teams: previewTeamNames.length,
  squadMoves: [
    { at: Date.now() - 2 * HOUR_MS, kind: "playerAssigned", playerName: "Saka", teamName: MINE, fromTeamName: null },
    TRADED,
    { at: Date.now() - DAY_MS, kind: "playerMoved", playerName: "Reijnders", teamName: previewRivals[0], fromTeamName: "Haaland Oates" },
    { at: Date.now() - 3 * DAY_MS, kind: "playerReleased", playerName: "Minteh", teamName: "Expected Toulouse", fromTeamName: null },
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
    text: recapText(),
  },
};

/** The recap's words, its men's points their cards' in the gameweek (#2466): the manager's three
 *  top starters, and his opponent's man who scored least. The bench line is made up. */
function recapText(): string {
  const opponent = previewOpponentOf(SCORED) ?? previewOpponent;
  const pointsOf = (codes: readonly { code: number; name: string }[]) =>
    codes.flatMap(({ code, name }) => {
      const points = previewSeasonOf(code).pointsIn(SCORED);
      return points === null ? [] : [{ name, points }];
    });
  const mine = pointsOf(previewSquad.filter(({ playerCode }) => startersOf.has(playerCode)).map(({ playerCode, name }) => ({ code: playerCode, name }))).toSorted((one, other) => other.points - one.points);
  const [lowest] = pointsOf(previewPlayers.filter(({ ownerTeamName }) => ownerTeamName === opponent)).toSorted((one, other) => one.points - other.points);
  const [top, ...next] = mine.slice(0, RECAP_PLAYERS);
  const ahead = next.map(({ name, points }) => `${name}'s ${points}`).join(" and ");
  return [
    `${MINE} met ${opponent} in the game of Gameweek ${SCORED}.`,
    top === undefined ? null : `${top.name} led the performers with ${top.points} for ${MINE}${ahead === "" ? "" : `, ahead of ${ahead}`}.`,
    lowest === undefined ? null : `${lowest.name} managed only ${lowest.points} for ${opponent}.`,
    "Expected Toulouse left 14 on the bench, the most of anyone.",
  ]
    .filter((sentence) => sentence !== null)
    .join(" ");
}

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
    teams: previewTeamNames.map((team) => ({ teamId: previewIdOf(team), teamName: team })),
    pinnedLetter: home.pinnedLetter,
  };
};

export const previewHome: HomeSeam = {
  useLeagueHome: () => home,
  useLatestMail: () => previewLatestMail,
  useRecap: (_, gameweek) => (gameweek === undefined || gameweek === SCORED ? home.recap : null),
  useLeagueNews: (_, { before, teamId, kind }) => {
    const page = news(before);
    return { ...page, moves: page.moves.filter((move) => (teamId === null || namesTeam(move, teamId)) && (kind === null || move.kind === kind)) };
  },
};
