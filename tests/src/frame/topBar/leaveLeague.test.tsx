// Leaving a league from the top bar (#134, spec/13 Leaving): a manager leaves the league they're in
// from the foot of the league list, after a plain confirm; the server's refusal is shown as is.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { refusals } from "../../../../convex/shared/leagueAccess";
import { MY_TEAM_PATH } from "../../../../src/frame/menu";
import { currentLeagueLabel, leaveWords } from "../../../../src/frame/words";
import { LEAGUES_PATH } from "../../../../src/leagues/paths";
import { LEAGUES_TITLE } from "../../../../src/leagues/words";
import { league, manager, managerIn, miniBeta, newcomer, openApp } from "../../../support/src/shell.harness";

const openList = async () => userEvent.click(await screen.findByRole("button", { name: new RegExp(`^${currentLeagueLabel} `) }));
const leaveOffered = () => screen.queryByRole("button", { name: leaveWords.open }) !== null;

describe("leaving the league", () => {
  it("asks first, then leaves the league the app is in, and closes the list", async () => {
    const app = openApp(MY_TEAM_PATH, manager);
    await openList();
    await userEvent.click(screen.getByRole("button", { name: leaveWords.open }));

    expect(screen.getByText(leaveWords.confirm(league.name, "Team 1"))).toBeTruthy();
    expect(app.leagues.leaveLeague).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: leaveWords.yes }));

    expect(app.leagues.leaveLeague).toHaveBeenCalledExactlyOnceWith(league.leagueId);
    expect(screen.queryByRole("list", { name: LEAGUES_TITLE })).toBeNull();
  });

  it("staying asks the server nothing", async () => {
    const app = openApp(MY_TEAM_PATH, manager);
    await openList();
    await userEvent.click(screen.getByRole("button", { name: leaveWords.open }));
    await userEvent.click(screen.getByRole("button", { name: leaveWords.no }));

    expect(app.leagues.leaveLeague).not.toHaveBeenCalled();
    expect(leaveOffered()).toBe(true);
  });

  it("is told why the server refused, someone running no team there, with the list still open", async () => {
    const app = openApp(MY_TEAM_PATH, manager);
    app.leagues.leaveLeague.mockResolvedValue(refusals.runsNoTeam);
    await openList();
    await userEvent.click(screen.getByRole("button", { name: leaveWords.open }));
    await userEvent.click(screen.getByRole("button", { name: leaveWords.yes }));

    expect((await screen.findByRole("alert")).textContent).toBe(refusals.runsNoTeam);
    expect(screen.getByRole("list", { name: LEAGUES_TITLE })).toBeTruthy();
  });

  it("isn't offered in a league where they run no team", async () => {
    openApp(MY_TEAM_PATH, { ...managerIn(league, miniBeta), currentLeagueId: miniBeta.leagueId });
    await openList();

    expect(within(screen.getByRole("list", { name: LEAGUES_TITLE })).getAllByRole("button")).toHaveLength(2);
    expect(leaveOffered()).toBe(false);
  });

  it("having left their only league, takes them to their leagues", async () => {
    const app = openApp(MY_TEAM_PATH, manager);
    await openList();
    await userEvent.click(screen.getByRole("button", { name: leaveWords.open }));
    await userEvent.click(screen.getByRole("button", { name: leaveWords.yes }));
    app.becomes(newcomer);

    expect(await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE })).toBeTruthy();
    expect(app.path()).toBe(LEAGUES_PATH);
  });
});
