// The admin's "Create a league" (spec/13, Creating a league): its form, and what it says when
// the league isn't made.

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { admin, openApp } from "../../support/src/shell.harness";
import { LEAGUES_PATH, NEW_LEAGUE_PATH } from "../../../src/leagues/paths";
import { backToLeaguesWords, LEAGUES_TITLE, newLeagueLabels } from "../../../src/leagues/words";

const REFUSAL = "Only the admin can do that.";

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
    app.leagues.createLeague.mockResolvedValue(REFUSAL);
    await fillIn();

    expect((await screen.findByRole("alert")).textContent).toBe(REFUSAL);
    expect((screen.getByRole("textbox", { name: newLeagueLabels.name }) as HTMLInputElement).value).toBe("Mini beta");
    expect(app.path()).toBe(NEW_LEAGUE_PATH);
  });

  it("can't be sent twice while the first is on its way", async () => {
    const app = openApp(NEW_LEAGUE_PATH, admin);
    app.leagues.createLeague.mockReturnValue(new Promise(() => {}));
    await fillIn();

    expect((screen.getByRole("button", { name: newLeagueLabels.create }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("goes back to the admin's leagues without making one", async () => {
    const app = openApp(NEW_LEAGUE_PATH, admin);
    await userEvent.click(await screen.findByRole("link", { name: backToLeaguesWords }));

    expect(await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE })).toBeTruthy();
    expect(app.leagues.createLeague).not.toHaveBeenCalled();
  });
});
