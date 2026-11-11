// The admin's "Create a league" (spec/13, Creating a league): its form, and what it says when
// the league isn't made.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { admin, openApp } from "../../support/src/shell.harness";
import { ADMIN_PATH } from "../../../src/admin/paths";
import { ADMIN_TITLE } from "../../../src/admin/words";
import { LEAGUES_PATH, NEW_LEAGUE_PATH } from "../../../src/leagues/paths";
import {
  adminWords,
  backToLeaguesWords,
  createLeagueHint,
  LEAGUES_TITLE,
  NEW_LEAGUE_TITLE,
  newLeagueLabels,
} from "../../../src/leagues/words";
import { LEAGUE_NAME_MAX } from "../../../convex/leagues/leagueLimits";
import { refusals } from "../../../convex/shared/leagueAccess";

/** Fills the form in as the admin would, and sends it. */
async function fillIn({ name = "Mini beta", maxTeams = "4", commissionerEmail = "commish@example.com" } = {}) {
  await userEvent.type(await screen.findByRole("textbox", { name: newLeagueLabels.name }), name);
  await userEvent.type(screen.getByRole("spinbutton", { name: newLeagueLabels.maxTeams }), maxTeams);
  await userEvent.type(screen.getByRole("textbox", { name: newLeagueLabels.commissionerEmail }), commissionerEmail);
  await userEvent.click(screen.getByRole("button", { name: newLeagueLabels.create }));
}

describe("creating a league", () => {
  it("asks for the league with its name, its maximum as a number and its commissioner, then shows the admin's leagues", async () => {
    const app = openApp(NEW_LEAGUE_PATH, admin);
    await fillIn();

    expect(app.leagues.createLeague).toHaveBeenCalledWith({ name: "Mini beta", maxTeams: 4, commissionerEmail: "commish@example.com" });
    expect(await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE })).toBeTruthy();
    expect(app.path()).toBe(LEAGUES_PATH);
  });

  it("says why a league wasn't made, and stays on the form with what was typed", async () => {
    const app = openApp(NEW_LEAGUE_PATH, admin);
    app.leagues.createLeague.mockResolvedValue(refusals.notAdmin);
    await fillIn();

    expect((await screen.findByRole("alert")).textContent).toBe(refusals.notAdmin);
    expect((screen.getByRole("textbox", { name: newLeagueLabels.name }) as HTMLInputElement).value).toBe("Mini beta");
    expect(app.path()).toBe(NEW_LEAGUE_PATH);
  });

  it(`says a name over ${LEAGUE_NAME_MAX} characters is refused, in the server's words`, async () => {
    const app = openApp(NEW_LEAGUE_PATH, admin);
    app.leagues.createLeague.mockResolvedValue(refusals.leagueNameTooLong);
    await fillIn({ name: "x".repeat(LEAGUE_NAME_MAX + 1) });

    expect((await screen.findByRole("alert")).textContent).toBe(`A league's name is up to ${LEAGUE_NAME_MAX} characters.`);
    expect(app.leagues.createLeague).toHaveBeenCalledWith(expect.objectContaining({ name: "x".repeat(LEAGUE_NAME_MAX + 1) }));
  });

  it("can't be sent twice while the first is on its way", async () => {
    const app = openApp(NEW_LEAGUE_PATH, admin);
    app.leagues.createLeague.mockReturnValue(new Promise(() => {}));
    await fillIn();

    expect((screen.getByRole("button", { name: newLeagueLabels.create }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("says the name's limit, and under Create the league that a link is emailed, with no line under the email (#1498)", async () => {
    openApp(NEW_LEAGUE_PATH, admin);
    const nameBox = await screen.findByRole("textbox", { name: newLeagueLabels.name });

    expect(document.getElementById(nameBox.getAttribute("aria-describedby") ?? "")?.textContent).toBe(`Up to ${LEAGUE_NAME_MAX} characters.`);
    expect(screen.getByText(createLeagueHint)).toBeTruthy();
    expect(screen.getByRole("textbox", { name: newLeagueLabels.commissionerEmail }).getAttribute("aria-describedby")).toBeNull();
  });

  it("titles the page in a panel's plate, with the Admin panel beside the form opening the dashboard and Your leagues", async () => {
    const app = openApp(NEW_LEAGUE_PATH, admin);
    expect(await screen.findByRole("heading", { level: 1, name: NEW_LEAGUE_TITLE })).toBeTruthy();
    const adminPanel = screen.getByRole("region", { name: adminWords });

    expect(within(adminPanel).getByRole("link", { name: ADMIN_TITLE }).getAttribute("href")).toBe(ADMIN_PATH);
    await userEvent.click(within(adminPanel).getByRole("link", { name: LEAGUES_TITLE }));
    expect(await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE })).toBeTruthy();
    expect(app.path()).toBe(LEAGUES_PATH);
  });

  it("goes back to the admin's leagues without making one", async () => {
    const app = openApp(NEW_LEAGUE_PATH, admin);
    await userEvent.click(await screen.findByRole("link", { name: backToLeaguesWords }));

    expect(await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE })).toBeTruthy();
    expect(app.leagues.createLeague).not.toHaveBeenCalled();
  });
});
