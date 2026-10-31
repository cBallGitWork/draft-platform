// Scouting's screen tests' shared setup (#373, spec/19 The players list): three players across two
// clubs, two owned and one a free agent, the app opened on Scouting with them, and the ways to read
// the players list and what it last asked the server.

import { screen, within } from "@testing-library/react";
import type { ListedPlayer } from "../../../convex/scouting/playersList";
import { SCOUTING_PATH } from "../../../src/frame/menu";
import { ARSENAL, CHELSEA } from "../convex/footballRows.harness";
import type { ScoutingData } from "./scouting.harness";
import { manager, openApp } from "./shell.harness";

const player = (code: number, name: string, club: ListedPlayer["club"], positions: ListedPlayer["positions"], ownerTeamName: string | null): ListedPlayer => ({
  code,
  name,
  fullName: `${name} in full`,
  club,
  positions,
  ownerTeamName,
  seasonPoints: null,
  stat: null,
});
export const SAKA = player(1, "Saka", ARSENAL, ["W"], "Saka Potatoes");
export const RICE = player(2, "Rice", ARSENAL, ["CDM", "CM"], null);
export const PALMER = player(3, "Palmer", CHELSEA, ["CAM"], "Kroos Control");
export const HELD: ScoutingData = { clubs: [ARSENAL, CHELSEA], players: [SAKA, RICE, PALMER] };

export const openScouting = (scouting: ScoutingData = HELD) => openApp(SCOUTING_PATH, manager, { scouting });
export const table = () => screen.getByRole("table");
export const namesShown = () =>
  within(table())
    .getAllByRole("rowheader")
    .map((cell) => cell.textContent);
export const rowOf = (name: string) => within(table()).getByRole("rowheader", { name }).closest("tr")!;
export const lastAsk = (app: ReturnType<typeof openScouting>) => app.scouting.usePlayersList.mock.lastCall!;
