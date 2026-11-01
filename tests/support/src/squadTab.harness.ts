// The Squad tab's tests' rows and lineups (tests/src/myTeam/squad*.test.tsx): a few players as the
// server sends them, and the Tactics lineup that says who starts.

import { screen, within } from "@testing-library/react";
import type { Cell } from "../../../convex/lineup/pitch";
import type { TeamSquad } from "../../../src/myTeam/seam";
import type { SquadMember } from "../../../src/myTeam/tactics/lineupDraft";
import { MY_TEAM_SQUAD_PATH } from "../../../src/frame/menu";
import { squadTableLabel } from "../../../src/myTeam/squad/words";
import { ARSENAL, CHELSEA } from "../convex/footballRows.harness";
import type { MyTeamData } from "./myTeam.harness";
import { manager, openApp } from "./shell.harness";
import { openTactics } from "./tactics.harness";

export type Row = TeamSquad["players"][number];

export const openSquad = (myTeam: MyTeamData = {}, session = manager) => openApp(MY_TEAM_SQUAD_PATH, session, { myTeam });

/** The table's rows under its head, and a row's cells' words. */
export const rows = () =>
  within(screen.getByRole("table", { name: squadTableLabel("Team 1") }))
    .getAllByRole<HTMLTableRowElement>("row")
    .slice(1);
export const cells = (row: HTMLTableRowElement) => Array.from(row.cells, (cell) => cell.textContent);

export const KICKOFF = Date.parse("2026-10-31T15:00:00Z");
const NO_STATS = { appearances: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, saves: 0, yellowCards: 0, redCards: 0 };
export const SAKA: Row = {
  code: 1001,
  name: "Saka",
  fullName: "Bukayo Saka",
  positions: ["W", "CAM"],
  club: ARSENAL,
  gone: false,
  number: 7,
  nextFixtures: [{ gameweek: 10, kickoff: KICKOFF, opponent: CHELSEA, home: true }],
  seasonPoints: 42,
  lastGameweekPoints: 7,
  form: [3, 7, null, 12, 7],
  stats: { ...NO_STATS, appearances: 8, minutes: 590, goals: 3, assists: 4, cleanSheets: 3, yellowCards: 1 },
  news: null,
  chanceOfPlaying: null,
};
export const PALMER: Row = {
  ...SAKA,
  code: 1002,
  name: "Palmer",
  fullName: "Cole Palmer",
  number: null,
  positions: ["CAM"],
  club: CHELSEA,
  nextFixtures: [{ ...SAKA.nextFixtures[0], opponent: ARSENAL, home: false }],
  seasonPoints: null,
  lastGameweekPoints: null,
  form: [null, null, null, null, null],
};
export const RAYA: Row = { ...SAKA, code: 1003, name: "Raya", fullName: "David Raya", positions: ["GK"], number: 1, stats: { ...NO_STATS, appearances: 8, minutes: 720, saves: 24 } };

export const squadOf = (players: Row[], lastGameweek: number | null = 9, unheld: number[] = [], squadMaximum: number | null = null): TeamSquad => ({
  teamName: "Team 1",
  lastGameweek,
  players,
  unheld,
  squadMaximum,
});

/** A squad member as the Tactics tab's read holds him. */
const memberOf = ({ code, name, club, positions, number }: Row): SquadMember => ({
  playerCode: code,
  name,
  clubShortName: club.shortName,
  clubCode: club.code,
  unheld: false,
  positions,
  number,
  stars: [],
});

/** The Tactics read with these players starting in these cells, and the rest of `players` on the
 *  bench in their order. */
export function tacticsWith(players: readonly Row[], starting: readonly [Row, Cell][]) {
  const starters = starting.map(([player, cell]) => ({ playerCode: player.code, ...cell }));
  const bench = players.filter((player) => !starting.some(([starter]) => starter.code === player.code)).map(({ code }) => code);
  const base = openTactics();
  return openTactics({ squad: players.map(memberOf), lineup: { ...base.lineup, starters, bench } });
}
