// The commissioner's gameweeks (#74; spec/13, Gameweeks): reached from "Your leagues" by whoever
// runs the league, a tick for each gameweek, and what it says when a tick is refused.

import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { LeagueSummary } from "../../convex/myLeagues";
import { LEAGUES_PATH } from "../leagues/paths";
import { adminSeeing, league, managerIn, openApp } from "../shell.harness";
import { BEGUN, season } from "./gameweeks.harness";
import { gameweeksPath } from "./paths";
import { begunWords, deadlineWords, GAMEWEEKS_TITLE, loadingWords, tickLabel } from "./words";

afterEach(cleanup);

const commissioned: LeagueSummary = { ...league, roles: ["commissioner"], teamName: null };
const commissioner = managerIn(commissioned);
const PAGE = gameweeksPath(league.leagueId);
const REFUSAL = "Gameweek 17 has begun, so it can't be ticked or unticked.";

const tickBox = (gameweek: number) => screen.findByRole("checkbox", { name: tickLabel(gameweek) });
const isTicked = async (gameweek: number) => (await tickBox(gameweek)).getAttribute("aria-checked") === "true";
const isDisabled = async (gameweek: number) => ((await tickBox(gameweek)) as HTMLButtonElement).disabled;
/** The row headed by a gameweek's number. */
const rowOf = (gameweek: number) => screen.getByRole("rowheader", { name: String(gameweek) }).closest("tr")!;

describe("reaching the gameweeks", () => {
  it.each([
    ["the commissioner", commissioner],
    ["the co-commissioner", managerIn({ ...league, roles: ["co-commissioner"] })],
    ["the admin, with no part in the league", adminSeeing({ ...league, roles: [], teamName: null })],
  ])("%s opens them from the league's row on Your leagues", async (_, session) => {
    const app = openApp(LEAGUES_PATH, session);
    await userEvent.click(await screen.findByRole("link", { name: GAMEWEEKS_TITLE }));

    expect(await screen.findByRole("heading", { level: 1, name: GAMEWEEKS_TITLE })).toBeTruthy();
    expect(app.path()).toBe(PAGE);
    expect(app.gameweeks.useLeagueGameweeks).toHaveBeenCalledWith(league.leagueId);
  });

  it("a manager who doesn't run the league isn't offered them", async () => {
    openApp(LEAGUES_PATH, managerIn(league));
    await screen.findByRole("heading", { level: 1, name: "Your leagues" });
    expect(screen.queryByRole("link", { name: GAMEWEEKS_TITLE })).toBeNull();
  });

  it("a manager who doesn't run the league, opening them, is sent back to their leagues", async () => {
    const app = openApp(PAGE, managerIn(league));
    expect(await screen.findByRole("heading", { level: 1, name: "Your leagues" })).toBeTruthy();
    expect(app.path()).toBe(LEAGUES_PATH);
    expect(app.gameweeks.useLeagueGameweeks).not.toHaveBeenCalled();
  });
});

describe("the gameweeks page", () => {
  it("shows all 38 ticked by default, how many the league plays, and each one's deadline", async () => {
    openApp(PAGE, commissioner);

    expect(await isTicked(38)).toBe(true);
    expect(screen.getAllByRole("checkbox")).toHaveLength(38);
    expect(screen.getAllByRole("checkbox").every((box) => box.getAttribute("aria-checked") === "true")).toBe(true);
    expect(screen.getByText(`${league.name} plays`, { exact: false }).textContent).toBe(`${league.name} plays 38 of 38 gameweeks.`);
    expect(within(rowOf(BEGUN + 1)).getByText(deadlineWords(season()[BEGUN].deadline!))).toBeTruthy();
  });

  it("an unticked gameweek shows unticked, and isn't counted", async () => {
    const app = openApp(PAGE, commissioner);
    const unticked = season([17, 18]);
    app.gameweeks.useLeagueGameweeks.mockReturnValue({ gameweeks: unticked, setUsed: app.gameweeks.setUsed });
    app.becomes(commissioner);

    expect(await isTicked(17)).toBe(false);
    expect(await isTicked(19)).toBe(true);
    expect(screen.getByText(`${league.name} plays`, { exact: false }).textContent).toBe(`${league.name} plays 36 of 38 gameweeks.`);
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
