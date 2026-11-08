// League home's tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { HomeSeam, LeagueHome, LeagueNews, NewsAsked, NewsMove, Recap } from "../../../src/home/seam";

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
 *  `points` says. */
export const homeFixture = (team: string, opponent: string | null, points: { team: number; opponent: number } | null = null) => ({
  teamId: `team-${team}` as Id<"teams">,
  team,
  opponent,
  points,
});

/** Two teams in gameweek 1, nothing scored, moved or written, no matchday open: what league home
 *  holds by default. */
export const quietHome: LeagueHome = {
  format: "headToHead",
  thisGameweek: { gameweek: 1, fixtures: [homeFixture("Team 1", "Team 2")], byes: [] },
  matchday: null,
  table: [homeRow(1, "Team 1", { mine: true }), homeRow(2, "Team 2")],
  teams: 2,
  squadMoves: [],
  pinnedLetter: null,
  recap: null,
};

/** Gameweek 1's recap, written, no score changed since. */
export const gameweekOneRecap: Recap = { gameweek: 1, text: "Team 1 beat Team 2.\nSaka scored 15.", writtenAt: Date.parse("2026-10-27T09:00:00Z"), changedTeamId: null };

/** A move on the News tab, at `at`, of `team`: Saka joining it unless `rest` says otherwise. */
export const newsMove = (at: number, teamName: string, rest: Partial<NewsMove> = {}): NewsMove => ({
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
  by: "commish@example.com",
  ...rest,
});

/** No moves and no letter, the league's two teams to filter by. */
export const quietNews: LeagueNews = {
  moves: [],
  older: null,
  teams: [
    { teamId: "team-Team 1" as Id<"teams">, teamName: "Team 1" },
    { teamId: "team-Team 2" as Id<"teams">, teamName: "Team 2" },
  ],
  pinnedLetter: null,
};

/** What the fake server holds: league home, null for a league with no rules, or nothing yet while
 *  it loads; its recaps, by gameweek; and the News tab's pages, by what each asks. */
export type HomeData = { leagueHome?: LeagueHome | null; loading?: boolean; recaps?: readonly Recap[]; news?: (asked: NewsAsked) => LeagueNews };

export function fakeHome({ leagueHome = quietHome, loading = false, recaps = [], news = () => quietNews }: HomeData = {}) {
  return {
    useLeagueHome: vi.fn<HomeSeam["useLeagueHome"]>(() => (loading ? undefined : leagueHome)),
    useRecap: vi.fn<HomeSeam["useRecap"]>((_, gameweek) => (loading ? undefined : (recaps.find((recap) => recap.gameweek === gameweek) ?? null))),
    useLeagueNews: vi.fn<HomeSeam["useLeagueNews"]>((_, asked) => (loading ? undefined : news(asked))),
  };
}
