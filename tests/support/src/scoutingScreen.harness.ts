// Scouting's screen tests' shared setup (#373, spec/19 The players list): three players across two
// clubs, two owned and one a free agent, the app opened on Scouting with them, and the ways to read
// the players list and what it last asked the server.

import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, vi } from "vitest";
import { MINUTE_MS } from "../../../convex/shared/time";
import { availabilityWords, PLAYERS_TITLE } from "../../../src/scouting/words";
import type { ListedPlayer } from "../../../convex/scouting/playersList";
import { NO_FIGURES } from "../../../convex/scouting/playersOrder";
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
  onWaivers: null,
  seasonPoints: null,
  points: null,
  figures: NO_FIGURES,
  stat: null,
});
export const SAKA = player(1, "Saka", ARSENAL, ["W"], "Saka Potatoes");
export const RICE = player(2, "Rice", ARSENAL, ["CDM", "CM"], null);
export const PALMER = player(3, "Palmer", CHELSEA, ["CAM"], "Kroos Control");
export const HELD: ScoutingData = { clubs: [ARSENAL, CHELSEA], players: [SAKA, RICE, PALMER] };

export const openScouting = (scouting: ScoutingData = HELD) => openApp(SCOUTING_PATH, manager, { scouting });
/** Scouting opened, then its All view chosen: it opens on free agents. */
export async function openOnAll(scouting: ScoutingData = HELD) {
  const app = openScouting(scouting);
  await userEvent.click(await screen.findByRole("radio", { name: availabilityWords.all }));
  return app;
}
/** The players list's table, apart from the selected player's figures per 90. */
export const table = () => within(screen.getByRole("region", { name: PLAYERS_TITLE })).getByRole("table");
/** A row's name: the link to his card that heads it, after which come a star and his club. */
const nameIn = (cell: HTMLElement) => within(cell).getAllByRole("link")[0].textContent;
export const namesShown = () => within(table()).getAllByRole("rowheader").map(nameIn);
export const rowOf = (name: string) =>
  within(table())
    .getAllByRole("rowheader")
    .find((cell) => nameIn(cell) === name)!
    .closest("tr")!;
export const lastAsk = (app: ReturnType<typeof openScouting>) => app.scouting.usePlayersList.mock.lastCall!;
/** The minute turns, and the manager's own player is asked again at the new one, which, like
 *  Convex's useQuery for args it hasn't answered, gives nothing yet (#1777). Needs fake timers set
 *  before Scouting opens, so the screen's minute is theirs. */
export function turnTheMinute(app: ReturnType<typeof openScouting>) {
  const { useYourPlayer } = app.scouting;
  const answered = useYourPlayer.mock.lastCall![2];
  const answer = useYourPlayer.getMockImplementation()!;
  useYourPlayer.mockImplementation((leagueId, playerCode, now) => (now === answered ? answer(leagueId, playerCode, now) : undefined));
  act(() => vi.advanceTimersByTime(MINUTE_MS));
  expect(useYourPlayer.mock.lastCall![2]).not.toBe(answered);
}
