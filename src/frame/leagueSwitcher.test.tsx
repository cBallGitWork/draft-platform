// The top bar's league switcher (#76, spec/13, Several leagues): a manager in several leagues
// switches between them from a list in the top bar, and the app opens in the one used last.

import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSummary } from "../../convex/myLeagues";
import { LEAGUES_PATH } from "../leagues/paths";
import { adminSeeing, league, manager, managerIn, openApp } from "../shell.harness";
import { MY_TEAM_PATH } from "./menu";

afterEach(cleanup);

const miniBeta: LeagueSummary = {
  ...league,
  leagueId: "league-2" as Id<"leagues">,
  name: "Mini beta",
  roles: ["commissioner"],
  teamName: null,
};
const inTwo = managerIn(league, miniBeta);
const inMiniBeta = { ...inTwo, currentLeagueId: miniBeta.leagueId };

const switcher = () => screen.findByRole("button", { name: /^League: / });
const choices = () => within(screen.getByRole("list", { name: "Your leagues" })).getAllByRole("button");

describe("a manager in two leagues", () => {
  it("opening the app is in the league they used last, named in the top bar", async () => {
    const app = openApp("/", inMiniBeta);
    expect((await switcher()).textContent).toBe("League: Mini beta");
    expect(app.path()).toBe(MY_TEAM_PATH);
  });

  it("opens the list, seeing each league with their team or part, the one they're in marked", async () => {
    openApp(MY_TEAM_PATH, inTwo);
    await userEvent.click(await switcher());

    expect(choices().map((choice) => choice.textContent)).toEqual(["Tim Hortons Pro LeagueTeam 1", "Mini betaCommissioner"]);
    expect(within(screen.getByRole("list", { name: "Your leagues" })).getByRole("button", { current: true }).textContent).toBe(
      "Tim Hortons Pro LeagueTeam 1",
    );
    expect((await switcher()).getAttribute("aria-expanded")).toBe("true");
  });

  it("switches to the other league, staying on the page, and the top bar names it once the app is in it", async () => {
    const app = openApp("/team/squad", inTwo);
    await userEvent.click(await switcher());
    await userEvent.click(screen.getByRole("button", { name: /^Mini beta/ }));

    expect(app.leagues.chooseLeague).toHaveBeenCalledWith(miniBeta.leagueId);
    expect(screen.queryByRole("list", { name: "Your leagues" })).toBeNull();
    app.becomes(inMiniBeta);
    expect((await switcher()).textContent).toBe("League: Mini beta");
    expect(app.path()).toBe("/team/squad");
  });

  it("choosing the league they're in closes the list without asking the server", async () => {
    const app = openApp(MY_TEAM_PATH, inTwo);
    await userEvent.click(await switcher());
    await userEvent.click(screen.getByRole("button", { current: true }));

    expect(app.leagues.chooseLeague).not.toHaveBeenCalled();
    expect(screen.queryByRole("list", { name: "Your leagues" })).toBeNull();
  });

  it("is told why a switch was refused, with the list still open", async () => {
    const app = openApp(MY_TEAM_PATH, inTwo);
    app.leagues.chooseLeague.mockResolvedValue("You're not in that league.");
    await userEvent.click(await switcher());
    await userEvent.click(screen.getByRole("button", { name: /^Mini beta/ }));

    expect((await screen.findByRole("alert")).textContent).toBe("You're not in that league.");
    expect(choices()).toHaveLength(2);
  });

  it("can't switch twice while the first is on its way", async () => {
    const app = openApp(MY_TEAM_PATH, inTwo);
    app.leagues.chooseLeague.mockReturnValue(new Promise(() => {}));
    await userEvent.click(await switcher());
    await userEvent.click(screen.getByRole("button", { name: /^Mini beta/ }));

    expect(choices().every((choice) => (choice as HTMLButtonElement).disabled)).toBe(true);
  });

  it.each([
    ["Escape", () => userEvent.keyboard("{Escape}")],
    ["a tap on the page", () => userEvent.click(screen.getByRole("heading", { level: 1 }))],
  ])("closes the list with %s, switching nothing", async (_, close) => {
    const app = openApp(MY_TEAM_PATH, inTwo);
    await userEvent.click(await switcher());
    await close();

    expect(screen.queryByRole("list", { name: "Your leagues" })).toBeNull();
    expect(app.leagues.chooseLeague).not.toHaveBeenCalled();
  });

  it("reaches all their leagues from the list", async () => {
    const app = openApp(MY_TEAM_PATH, inTwo);
    await userEvent.click(await switcher());
    await userEvent.click(screen.getByRole("link", { name: "All your leagues" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Your leagues" })).toBeTruthy();
    expect(app.path()).toBe(LEAGUES_PATH);
    expect(screen.queryByRole("list", { name: "Your leagues" })).toBeNull();
  });
});

describe("the top bar's league, for someone in one", () => {
  it("is the league's plain name, with nothing to switch", async () => {
    openApp(MY_TEAM_PATH, manager);
    const main = await screen.findByRole("banner");
    expect(within(main).getByText(league.name)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^League: / })).toBeNull();
  });

  it("is the admin's own league alone, not those he only oversees", async () => {
    openApp(MY_TEAM_PATH, { ...adminSeeing(league, { ...miniBeta, roles: [] }), inLeague: true, currentLeagueId: league.leagueId });
    expect(within(await screen.findByRole("banner")).getByText(league.name)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^League: / })).toBeNull();
  });
});
