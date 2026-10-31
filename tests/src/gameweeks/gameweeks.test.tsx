// The commissioner's gameweeks (#74; spec/13, Gameweeks): reached from "Your leagues" by whoever
// runs the league, a tick for each gameweek, and what it says when a tick is refused.

import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GAMEWEEKS } from "../../../convex/gameweeks/usedGameweeks";
import { HOUR_MS, MINUTE_MS } from "../../../convex/shared/time";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { LEAGUES_TITLE } from "../../../src/leagues/words";
import { adminSeeing, coCommissioned, commissioner, league, managerIn, openApp, withNoPart } from "../../support/src/shell.harness";
import { BEGUN, season } from "../../support/src/gameweeks.harness";
import { gameweeksPath } from "../../../src/gameweeks/paths";
import { begunWords, gameweekColumns, GAMEWEEKS_TITLE, loadingWords } from "../../../src/gameweeks/words";
import { expectColumnHeads } from "../../support/src/columnHeads";
import { gameweekWords, whenWords } from "../../../src/shared/words";

const PAGE = gameweeksPath(league.leagueId);
const REFUSAL = "Gameweek 17 has begun, so it can't be ticked or unticked.";

const tickBox = async (gameweek: number) => (await screen.findByRole("checkbox", { name: gameweekWords(gameweek) })) as HTMLInputElement;
const isTicked = async (gameweek: number) => (await tickBox(gameweek)).checked;
const isDisabled = async (gameweek: number) => (await tickBox(gameweek)).disabled;
/** The line saying how many gameweeks the league plays. */
const playsLine = () => screen.getByText(`${league.name} plays`, { exact: false }).textContent;
/** The row headed by a gameweek's number. */
const rowOf = (gameweek: number) => screen.getByRole("rowheader", { name: String(gameweek) }).closest("tr")!;

describe("reaching the gameweeks", () => {
  it.each([
    ["the commissioner", commissioner],
    ["the co-commissioner", managerIn(coCommissioned)],
    ["the admin, with no part in the league", adminSeeing(withNoPart(league))],
  ])("%s opens them from the league's row on Your leagues", async (_, session) => {
    const app = openApp(LEAGUES_PATH, session);
    await userEvent.click(await screen.findByRole("link", { name: GAMEWEEKS_TITLE }));

    expect(await screen.findByRole("heading", { level: 1, name: GAMEWEEKS_TITLE })).toBeTruthy();
    expect(app.path()).toBe(PAGE);
    expect(app.gameweeks.useLeagueGameweeks).toHaveBeenCalledWith(league.leagueId);
  });

  it("a manager who doesn't run the league isn't offered them", async () => {
    openApp(LEAGUES_PATH, managerIn(league));
    await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE });
    expect(screen.queryByRole("link", { name: GAMEWEEKS_TITLE })).toBeNull();
  });

  it("a manager who doesn't run the league, opening them, is sent back to their leagues", async () => {
    const app = openApp(PAGE, managerIn(league));
    expect(await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE })).toBeTruthy();
    expect(app.path()).toBe(LEAGUES_PATH);
    expect(app.gameweeks.useLeagueGameweeks).not.toHaveBeenCalled();
  });
});

describe("the gameweeks page", () => {
  it("shows all 38 ticked by default, how many the league plays, and each one's deadline", async () => {
    const app = openApp(PAGE, commissioner);

    expect(await isTicked(GAMEWEEKS)).toBe(true);
    expect(screen.getAllByRole("checkbox")).toHaveLength(GAMEWEEKS);
    expect((screen.getAllByRole("checkbox") as HTMLInputElement[]).every((box) => box.checked)).toBe(true);
    expect(playsLine()).toBe(`${league.name} plays ${GAMEWEEKS} of ${GAMEWEEKS} gameweeks.`);
    expect(within(rowOf(BEGUN + 1)).getByText(whenWords(app.gameweeks.gameweeks[BEGUN].deadline!))).toBeTruthy();
  });

  it("heads each column of every table with its short word, named by its long one", async () => {
    openApp(PAGE, commissioner);
    await tickBox(1);
    for (const table of screen.getAllByRole("table")) expectColumnHeads(table, Object.values(gameweekColumns));
  });

  it("an unticked gameweek shows unticked, and isn't counted", async () => {
    const app = openApp(PAGE, commissioner);
    const unticked = season([17, 18]);
    app.gameweeks.useLeagueGameweeks.mockReturnValue({ gameweeks: unticked, setUsed: app.gameweeks.setUsed });
    app.becomes(commissioner);

    expect(await isTicked(17)).toBe(false);
    expect(await isTicked(19)).toBe(true);
    expect(playsLine()).toBe(`${league.name} plays ${GAMEWEEKS - 2} of ${GAMEWEEKS} gameweeks.`);
  });

  it("unticking a gameweek asks for it to be left out", async () => {
    const app = openApp(PAGE, commissioner);
    await userEvent.click(await tickBox(17));
    expect(app.gameweeks.setUsed).toHaveBeenCalledWith(17, false);
  });

  it("a gameweek that has begun says so, and its tick can't be changed", async () => {
    const app = openApp(PAGE, commissioner);

    expect(await isDisabled(BEGUN)).toBe(true);
    expect(within(rowOf(BEGUN)).getByText(begunWords)).toBeTruthy();
    expect(await isDisabled(BEGUN + 1)).toBe(false);
    await userEvent.click(await tickBox(BEGUN));
    expect(app.gameweeks.setUsed).not.toHaveBeenCalled();
  });

  it("a gameweek that begins while the page is open stops taking ticks within a minute", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    openApp(PAGE, commissioner);
    expect(await isDisabled(BEGUN + 1)).toBe(false);

    // BEGUN + 1's deadline is an hour on: a minute short of it, the tick still takes.
    act(() => vi.advanceTimersByTime(HOUR_MS - MINUTE_MS));
    expect(await isDisabled(BEGUN + 1)).toBe(false);

    // To the deadline, then a minute on: by then the page has redrawn.
    act(() => vi.advanceTimersByTime(2 * MINUTE_MS));
    expect(await isDisabled(BEGUN + 1)).toBe(true);
    expect(within(rowOf(BEGUN + 1)).getByText(begunWords)).toBeTruthy();
  });

  it("says why a tick was refused", async () => {
    const app = openApp(PAGE, commissioner);
    app.gameweeks.setUsed.mockResolvedValue(REFUSAL);
    await userEvent.click(await tickBox(17));

    expect((await screen.findByRole("alert")).textContent).toBe(REFUSAL);
  });

  it("a tick can't be sent twice while the first is on its way", async () => {
    const app = openApp(PAGE, commissioner);
    app.gameweeks.setUsed.mockReturnValue(new Promise(() => {}));
    await userEvent.click(await tickBox(17));

    expect(await isDisabled(17)).toBe(true);
    expect(await isDisabled(18)).toBe(false);
  });

  it("says so while the gameweeks load", async () => {
    const app = openApp(PAGE, commissioner);
    app.gameweeks.useLeagueGameweeks.mockReturnValue({ gameweeks: undefined, setUsed: app.gameweeks.setUsed });
    app.becomes(commissioner);

    expect((await screen.findByRole("status")).textContent).toBe(loadingWords);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
