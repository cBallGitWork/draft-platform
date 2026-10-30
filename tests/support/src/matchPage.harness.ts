// The match page's tests' one match (#45; spec/10, The match page): Arsenal v Chelsea, live, and
// the app opened at it. The page's tests share it across files.

import type { MatchMan, MatchPageData } from "../../../src/premierLeague/seam";
import { matchPath } from "../../../src/premierLeague/paths";
import { HOUR_MS } from "../../../convex/shared/time";
import { ARSENAL, CHELSEA, type PremierLeagueData } from "./premierLeague.harness";
import { manager, openApp } from "./shell.harness";

export const FIXTURE = 2645271;

export const man = (playerCode: number, name: string, side: MatchMan["side"], more: Partial<MatchMan> = {}): MatchMan => ({
  playerCode,
  name,
  position: "CM",
  side,
  started: true,
  played: true,
  ownerTeamName: null,
  points: null,
  counts: true,
  ...more,
});

export const MEN: MatchMan[] = [
  man(1, "Raya", "home", { position: "GK", ownerTeamName: "Team 1", points: 2 }),
  man(2, "Saka", "home", { ownerTeamName: "Team 2", points: 11 }),
  man(3, "Rice", "home", { ownerTeamName: "Team 1", points: null }),
  man(4, "Ødegaard", "home", { started: false, played: true }),
  man(5, "Arrizabalaga", "home", { position: "GK", started: false, played: false, ownerTeamName: "Team 1", points: 0, counts: false }),
  man(6, "Palmer", "away", { ownerTeamName: "Team 2", points: 7 }),
];

export const matchOf = (more: Partial<MatchPageData> = {}): MatchPageData => ({
  fixtureCode: FIXTURE,
  gameweek: 9,
  kickoff: Date.now() - HOUR_MS,
  home: ARSENAL,
  away: CHELSEA,
  score: { state: "live", homeGoals: 2, awayGoals: 1, minutes: 67, clockLabel: "67'12" },
  men: MEN,
  pointsProblem: null,
  teamStats: null,
  commentary: {
    kind: "read",
    lines: [
      { key: "a", text: "62' GOAL Saka, assist Ødegaard", points: "+5" },
      { key: "b", text: "KO ARS v CHE", points: null },
    ],
    delayed: false,
  },
  ...more,
});

export const openMatch = (premierLeague: PremierLeagueData, path = matchPath(FIXTURE)) => openApp(path, manager, { premierLeague });
