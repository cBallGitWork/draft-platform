// League home's tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { HomeSeam, LeagueHome, LeagueNews, NewsAsked, NewsMove, Recap } from "../../../src/home/seam";
import type { LatestMail } from "../../../src/myTeam/squad/seam";
import { MY_TEAM_NAME, THEIR_TEAM_NAME } from "./teams.harness";

type Row = LeagueHome["table"][number];

/** A row of league home's table, at `position`, played nothing unless `rest` says. */
export const homeRow = (position: number, teamName: string, rest: Partial<Row> = {}): Row => ({
  position,
  teamId: `team-${position}` as Id<"teams">,
  teamName,
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  points: 0,
  form: [],
  mine: false,
  ...rest,
});

/** A head-to-head of `team` against `opponent`, null for the league's average, unscored unless
 *  `points` says, and the team's first game in the gameweek unless `game` says. */
export const homeFixture = (team: string, opponent: string | null, points: { team: number; opponent: number } | null = null, game = 1) => ({
  teamId: `team-${team}` as Id<"teams">,
  game,
  team,
  opponent,
  points,
});

/** Two teams in gameweek 1, nothing scored, moved or written, no matchday open: what league home
 *  holds by default. */
export const quietHome: LeagueHome = {
  format: "headToHead",
  thisGameweek: { gameweek: 1, fixtures: [homeFixture(MY_TEAM_NAME, THEIR_TEAM_NAME)], byes: [] },
  matchday: null,
  table: [homeRow(1, MY_TEAM_NAME, { mine: true }), homeRow(2, THEIR_TEAM_NAME)],
  teams: 2,
  squadMoves: [],
  pinnedLetter: null,
  recap: null,
};

/** Gameweek 1's recap, written, no score changed since. */
export const gameweekOneRecap: Recap = { gameweek: 1, text: `${MY_TEAM_NAME} beat ${THEIR_TEAM_NAME}.\nSaka scored 15.`, writtenAt: Date.parse("2026-10-27T09:00:00Z"), changedTeamId: null };

/** A move on the News tab, at `at`, of `team`: Saka joining it unless `rest` says otherwise. */
export const newsMove = (at: number, teamName: string, rest: Partial<Exclude<NewsMove, { kind: "tradeMade" }>> = {}): NewsMove => ({
  at,
  filed: at,
  kind: "playerAssigned",
  teamId: `team-${teamName}` as Id<"teams">,
  teamName,
  joined: { playerCode: 1001, playerName: "Saka" },
  left: null,
  toWaivers: null,
  fromTeamId: null,
  fromTeamName: null,
  ...rest,
});

/** No moves and no letter, the league's two teams to filter by. */
export const quietNews: LeagueNews = {
  moves: [],
  older: null,
  teams: [MY_TEAM_NAME, THEIR_TEAM_NAME].map((teamName) => ({ teamId: `team-${teamName}` as Id<"teams">, teamName })),
  pinnedLetter: null,
};

/** What the fake server holds: league home, null for a league with no rules, or nothing yet while
 *  it loads; its recaps, by gameweek; the News tab's pages, by what each asks; and the newest
 *  letters, none unless `mail` says. */
export type HomeData = { leagueHome?: LeagueHome; loading?: boolean; recaps?: readonly Recap[]; news?: (asked: NewsAsked) => LeagueNews; mail?: LatestMail | null };

export function fakeHome({ leagueHome = quietHome, loading = false, recaps = [], news = () => quietNews, mail = { letters: [], unread: 0 } }: HomeData = {}) {
  return {
    useLatestMail: vi.fn<HomeSeam["useLatestMail"]>(() => (loading ? undefined : mail)),
    useLeagueHome: vi.fn<HomeSeam["useLeagueHome"]>(() => (loading ? undefined : leagueHome)),
    useRecap: vi.fn<HomeSeam["useRecap"]>((_, gameweek) => (loading ? undefined : (recaps.find((recap) => recap.gameweek === gameweek) ?? null))),
    useLeagueNews: vi.fn<HomeSeam["useLeagueNews"]>((_, asked) => (loading ? undefined : news(asked))),
  };
}
