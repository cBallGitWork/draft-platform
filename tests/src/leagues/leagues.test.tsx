// "Your leagues" (spec/12): a person's leagues, the page saying they're in none (spec/02), and
// the admin's "Create a league".

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { MY_TEAM_PATH } from "../../../src/frame/menu";
import { mainMenuLabel, signOutWords } from "../../../src/frame/words";
import { SIGN_IN_PATH } from "../../../src/sign-in/paths";
import { admin, adminSeeing, commissioned, league, manager, managerIn, newcomer, openApp, visitor, withNoPart } from "../../support/src/shell.harness";
import { LEAGUES_PATH, NEW_LEAGUE_PATH } from "../../../src/leagues/paths";
import { commissionerLine, LEAGUES_TITLE, newLeagueLabels, notInALeagueWords, unsentLink, unsentLinkWords } from "../../../src/leagues/words";
import { signInWords } from "../../../src/sign-in/words";

describe("someone signed in, in no league", () => {
  it.each(["/", MY_TEAM_PATH, SIGN_IN_PATH])("opening %s sees their leagues page, saying they're in none", async (path) => {
    const app = openApp(path, newcomer);
    expect(await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE })).toBeTruthy();
    expect(screen.getByText(notInALeagueWords("manager@example.com"))).toBeTruthy();
    expect(app.path()).toBe(LEAGUES_PATH);
  });

  // "Your invite to <league> expired / was cancelled / couldn't be used: <reason>. Ask the
  // commissioner for a new one." (Craig, 22 Oct 2026)
  it.each([
    [{ leagueName: "Mini beta", ended: "expired", reason: null }, "Your invite to Mini beta expired. Ask the commissioner for a new one."],
    [{ leagueName: "Mini beta", ended: "cancelled", reason: null }, "Your invite to Mini beta was cancelled. Ask the commissioner for a new one."],
    [
      { leagueName: "Mini beta", ended: "couldNotJoin", reason: "The league is full: it has all 4 of its teams." },
      "Your invite to Mini beta couldn't be used: The league is full: it has all 4 of its teams. Ask the commissioner for a new one.",
    ],
  ] as const)("whose newest invite ended without them joining is told how, and to ask for a new one", async (endedInvite, line) => {
    openApp(LEAGUES_PATH, newcomer, { joining: { endedInvite } });
    expect(await screen.findByText(line)).toBeTruthy();
    expect(screen.getByText(notInALeagueWords("manager@example.com"))).toBeTruthy();
  });

  it("with no invite to tell of, is told only that they're in none", async () => {
    openApp(LEAGUES_PATH, newcomer, { joining: { endedInvite: null } });
    await screen.findByText(notInALeagueWords("manager@example.com"));
    expect(screen.queryByText(/Your invite to/)).toBeNull();
  });

  it("sees no league menu and no Create a league, and can sign out", async () => {
    const app = openApp(LEAGUES_PATH, newcomer);
    await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE });
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("link", { name: "Create a league" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: signOutWords }));
    expect(app.auth.signOut).toHaveBeenCalledOnce();
    app.becomes(visitor);
    expect(await screen.findByRole("textbox", { name: signInWords.emailLabel })).toBeTruthy();
    expect(app.path()).toBe(SIGN_IN_PATH);
  });

  it("opening Create a league, not being the admin, is sent back to their leagues", async () => {
    const app = openApp(NEW_LEAGUE_PATH, newcomer);
    expect(await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE })).toBeTruthy();
    expect(app.path()).toBe(LEAGUES_PATH);
  });
});

describe("the admin, with no part in a league", () => {
  it("is offered Create a league, which opens its form", async () => {
    const app = openApp("/", admin);
    await userEvent.click(await screen.findByRole("link", { name: "Create a league" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Create a league" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: newLeagueLabels.name })).toBeTruthy();
    expect(app.path()).toBe(NEW_LEAGUE_PATH);
  });

  it("sees every league, as the admin where he has no other part, and a commissioner's link that didn't go", async () => {
    const unsentCommissionerLink = { email: league.commissionerEmail, reply: "paused" } as const;
    openApp(LEAGUES_PATH, adminSeeing({ ...withNoPart(league), unsentCommissionerLink }));

    const row = await rowOf(league.name);
    expect(cellsOf(row)).toEqual(["Admin", "None", "3 of 4"]);
    expect(screen.getByText(unsentLink(league.commissionerEmail, unsentLinkWords.paused))).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create a league" })).toBeTruthy();
  });
});

/** The row headed by a league's name, once the page shows it. */
async function rowOf(leagueName: string) {
  const header = await screen.findByRole("rowheader", { name: new RegExp(`^${leagueName}`) });
  return header.closest("tr")!;
}
const cellsOf = (row: HTMLElement) => within(row).getAllByRole("cell").map((cell) => cell.textContent);

describe("a manager in a league", () => {
  it("opening the leagues page sees each of their leagues, their part and team in it, inside the league frame", async () => {
    const app = openApp(
      LEAGUES_PATH,
      managerIn(league, { ...commissioned, leagueId: "league-2" as Id<"leagues">, name: "Mini beta", teams: 1 }),
    );

    const managed = await rowOf(league.name);
    expect(cellsOf(managed)).toEqual(["Manager", "Team 1", "3 of 4"]);
    expect(within(managed).getByText(commissionerLine(league.commissionerEmail))).toBeTruthy();
    expect(cellsOf(await rowOf("Mini beta"))).toEqual(["Commissioner, Manager", "Team 1", "1 of 4"]);
    expect(screen.getByRole("navigation", { name: mainMenuLabel })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Create a league" })).toBeNull();
    expect(app.path()).toBe(LEAGUES_PATH);
  });

  it("opening the app still lands on My team", async () => {
    const app = openApp("/", manager);
    expect(await screen.findByRole("heading", { level: 1, name: "My team" })).toBeTruthy();
    expect(app.path()).toBe(MY_TEAM_PATH);
  });
});
