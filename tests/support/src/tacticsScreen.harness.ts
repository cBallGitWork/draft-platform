// The Tactics tab's screen tests' shared setup (#14): a small Arsenal squad, four starting and two
// on the bench, and the ways to find the pitch, its players and targets, and the squad's rows.

import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LANES, type Cell } from "../../../convex/lineup/pitch";
import { ROWS_DRAWN } from "../../../src/myTeam/tactics/pitch/Pitch";
import type { Position } from "../../../convex/positions/positionTables";
import { MY_TEAM_PATH } from "../../../src/frame/menu";
import type { OpenTactics } from "../../../src/myTeam/tactics/seam";
import { allFormationsWords, BENCH_TITLE, moveLabel, pitchLabel, playerOnPitchLabel, squadTableLabel, swapLabel, undoWords } from "../../../src/myTeam/tactics/words";
import { applyWords } from "../../../src/myTeam/tactics/formationWindow/words";
import { ARSENAL } from "../convex/footballRows.harness";
import type { MyTeamData } from "./myTeam.harness";
import { manager, openApp } from "./shell.harness";
import { TACTICS_GAMEWEEK, openTactics } from "./tactics.harness";

export type Member = OpenTactics["squad"][number];
export const member = (playerCode: number, name: string, positions: Position[], number: number | null = null): Member => ({
  playerCode,
  name,
  clubShortName: ARSENAL.shortName,
  clubCode: ARSENAL.code,
  unheld: false,
  positions,
  number,
  stars: [],
});

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
  lineup: { fromGameweek: TACTICS_GAMEWEEK, starters: STARTERS, bench: [ARRIZABALAGA.playerCode, WHITE.playerCode], leftSquad: [], joinedBench: [], vacated: [] },
});

export const openTacticsTab = (myTeam: MyTeamData = { tactics: SAVED }, session = manager) => openApp(MY_TEAM_PATH, session, { myTeam });
export const pitch = () => screen.getByRole("group", { name: pitchLabel });
export const selectionTable = () => screen.getByRole("table", { name: squadTableLabel });
/** Each row of the Selection table under its heads, as its words read; the bench's plate as its
 *  title. */
export const squadRows = () =>
  within(selectionTable())
    .getAllByRole("row")
    .slice(1)
    .map((row) => (row.querySelector('th[scope="rowgroup"]') ? BENCH_TITLE : row.textContent));
/** The bench in order, by name. */
export const benchOrder = () => {
  const rows = within(selectionTable()).getAllByRole("row");
  const plate = rows.findIndex((row) => row.querySelector('th[scope="rowgroup"]'));
  return rows.slice(plate + 1).map((row) => row.querySelector("th button")?.textContent);
};
/** The player's row in the Selection table, by his name on it. */
export const rowOf = (player: Member) => within(selectionTable()).getByRole("button", { name: player.name }).closest("tr")!;
/** His panel opened by a tap on his name in the Selection table, unless it is open already. */
export async function openPanel(player: Member) {
  const name = within(await screen.findByRole("table", { name: squadTableLabel })).getByRole("button", { name: player.name });
  if (name.getAttribute("aria-pressed") !== "true") await userEvent.click(name);
}
/** The player picked up: his panel opened, then Move (the approved Tactics picture's interaction
 *  notes). */
export async function pickUp(player: Member) {
  await openPanel(player);
  await userEvent.click(screen.getByRole("button", { name: moveLabel(player.name) }));
}
/** A formation picked: its key where the toolbar has one, or from the formation window, through
 *  its back-line groups. */
export async function pickFormation(name: string) {
  const key = screen.queryByRole("radio", { name });
  if (key !== null) return userEvent.click(key);
  await userEvent.click(screen.getByRole("button", { name: allFormationsWords }));
  for (const group of screen.getAllByRole("button", { name: /^Back \d/ })) {
    await userEvent.click(group);
    const tile = screen.queryByRole("radio", { name });
    if (tile === null) continue;
    await userEvent.click(tile);
    return userEvent.click(screen.getByRole("button", { name: applyWords }));
  }
  throw new Error(`No formation called ${name}`);
}
export const blockOf = (player: Member, cell: Cell) => within(pitch()).getByRole("button", { name: playerOnPitchLabel(player.name, player.positions, cell.area, cell.lane) });
/** Every player lit on the pitch for the player picked up, to swap with: there are no empty cells
 *  to move into (presets only; #1022). */
export const swaps = () => within(pitch()).queryAllByRole("button", { name: /^Swap / }).map((target) => target.getAttribute("aria-label"));
/** Every player lit for the player picked up, on the pitch and in the Selection table. */
export const allSwaps = () => screen.queryAllByRole("button", { name: /^Swap / }).map((target) => target.getAttribute("aria-label"));
/** The player picked up and swapped with a lit one, by a tap on him wherever he is lit. */
export async function swap(player: Member, other: Member) {
  await pickUp(player);
  await userEvent.click(screen.getAllByRole("button", { name: swapLabel(player.name, other.name) })[0]);
}
/** The pitch's cell, empty or not, as a drop lands on it: the pitch's cells are its only child
 *  divs, drawn attack first, left to right. */
export const cellOn = (cell: Cell) => pitch().querySelectorAll(":scope > div")[ROWS_DRAWN.indexOf(cell.area) * LANES.length + LANES.indexOf(cell.lane)];
/** Each a stand-in for a drag's data, which some browsers need to start a drag. */
const DATA_TRANSFER = { setData: () => undefined, effectAllowed: "" };
/** A player's block or row dragged and dropped on `onto`, as a manager's mouse would. */
export function drag(from: Element, onto: Element) {
  fireEvent.dragStart(from, { dataTransfer: DATA_TRANSFER });
  fireEvent.dragOver(onto, { dataTransfer: DATA_TRANSFER });
  fireEvent.drop(onto, { dataTransfer: DATA_TRANSFER });
}
export const undo = () => screen.getByRole("button", { name: undoWords }) as HTMLButtonElement;
/** The tab opened on the lineup held, once its pitch is up. */
export async function openedPitch(myTeam?: MyTeamData) {
  const app = openTacticsTab(myTeam);
  await screen.findByRole("group", { name: pitchLabel });
  return app;
}

