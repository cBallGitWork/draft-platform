// The Tactics tab's screen tests' shared setup (#14): a small Arsenal squad, four starting and two
// on the bench, and the ways to find the pitch, its players and targets, and the squad's rows.

import { screen, within } from "@testing-library/react";
import type { Cell } from "../../../convex/lineup/pitch";
import type { Position } from "../../../convex/positions/positionTables";
import { MY_TEAM_PATH } from "../../../src/frame/menu";
import type { OpenTactics } from "../../../src/myTeam/tacticsSeam";
import { pitchLabel, playerOnPitchLabel, saveWords, squadTableLabel } from "../../../src/myTeam/tacticsWords";
import type { MyTeamData } from "./myTeam.harness";
import { manager, openApp } from "./shell.harness";
import { TACTICS_GAMEWEEK, openTactics } from "./tactics.harness";

export type Member = OpenTactics["squad"][number];
export const member = (playerCode: number, name: string, positions: Position[], number: number | null = null): Member => ({ playerCode, name, clubShortName: "ARS", positions, number });

export const RAYA = member(1, "Raya", ["GK"]);
export const SALIBA = member(2, "Saliba", ["CB"]);
export const RICE = member(3, "Rice", ["CDM", "CM"]);
export const HAVERTZ = member(4, "Havertz", ["ST"]);
export const ARRIZABALAGA = member(5, "Arrizabalaga", ["GK"]);
export const WHITE = member(6, "White", ["FB", "WB"]);
export const SQUAD = [RAYA, SALIBA, RICE, HAVERTZ, ARRIZABALAGA, WHITE];

export const at = (player: Member, cell: Cell) => ({ playerCode: player.playerCode, ...cell });
/** Four starters and two on the bench: the screen never judges whether eleven stand. */
export const STARTERS = [
  at(RAYA, { area: "goalkeeper", lane: "centre" }),
  at(SALIBA, { area: "defence", lane: "leftCentre" }),
  at(RICE, { area: "midfield", lane: "centre" }),
  at(HAVERTZ, { area: "attack", lane: "centre" }),
];
export const SAVED = openTactics({
  squad: SQUAD,
  lineup: { kind: "saved", fromGameweek: TACTICS_GAMEWEEK, starters: STARTERS, bench: [ARRIZABALAGA.playerCode, WHITE.playerCode], leftSquad: [], joinedBench: [] },
});

export const openTacticsTab = (myTeam: MyTeamData = { tactics: SAVED }, session = manager) => openApp(MY_TEAM_PATH, session, { myTeam });
export const pitch = () => screen.getByRole("group", { name: pitchLabel });
export const squadRows = () =>
  within(screen.getByRole("table", { name: squadTableLabel }))
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.textContent);
export const blockOf = (player: Member, cell: Cell) => within(pitch()).getByRole("button", { name: playerOnPitchLabel(player.name, player.positions, cell.area, cell.lane) });
export const targets = () => within(pitch()).queryAllByRole("button", { name: /^Put / }).map((target) => target.getAttribute("aria-label"));
export const save = () => screen.getByRole("button", { name: saveWords });
/** The tab opened on the lineup held, once its pitch is up. */
export async function openedPitch(myTeam?: MyTeamData) {
  const app = openTacticsTab(myTeam);
  await screen.findByRole("group", { name: pitchLabel });
  return app;
}

