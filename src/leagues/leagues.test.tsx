// Signed in, in no league (spec/02): the page saying so, and the admin's "Create a league".

import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { MY_TEAM_PATH } from "../frame/menu";
import { SIGN_IN_PATH } from "../router";
import { admin, manager, newcomer, openApp, visitor } from "../shell.harness";
import { LEAGUES_PATH, NEW_LEAGUE_PATH } from "./paths";

afterEach(cleanup);

describe("someone signed in, in no league", () => {
  it.each(["/", MY_TEAM_PATH, "/mail", SIGN_IN_PATH])("opening %s sees their leagues page, saying they're in none", async (path) => {
    const app = openApp(path, newcomer);
    expect(await screen.findByRole("heading", { level: 1, name: "Your leagues" })).toBeTruthy();
    expect(screen.getByText("You're signed in as manager@example.com, and you're not in a league yet.")).toBeTruthy();
    expect(app.path()).toBe(LEAGUES_PATH);
  });

  it("sees no league menu and no Create a league, and can sign out", async () => {
    const app = openApp(LEAGUES_PATH, newcomer);
    await screen.findByRole("heading", { level: 1, name: "Your leagues" });
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("link", { name: "Create a league" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(app.auth.signOut).toHaveBeenCalledOnce();
    app.becomes(visitor);
    expect(await screen.findByRole("textbox", { name: "Email" })).toBeTruthy();
    expect(app.path()).toBe(SIGN_IN_PATH);
  });

  it("opening Create a league, not being the admin, is sent back to their leagues", async () => {
    const app = openApp(NEW_LEAGUE_PATH, newcomer);
    expect(await screen.findByRole("heading", { level: 1, name: "Your leagues" })).toBeTruthy();
    expect(app.path()).toBe(LEAGUES_PATH);
  });
});

describe("the admin, in no league", () => {
  it("is offered Create a league, which opens its page (the form is #24)", async () => {
    const app = openApp("/", admin);
    await userEvent.click(await screen.findByRole("link", { name: "Create a league" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Create a league" })).toBeTruthy();
    expect(app.path()).toBe(NEW_LEAGUE_PATH);
  });
});

describe("a manager in a league", () => {
  it("opening the leagues page is sent to My team", async () => {
    const app = openApp(LEAGUES_PATH, manager);
    expect(await screen.findByRole("heading", { level: 1, name: "My team" })).toBeTruthy();
    expect(app.path()).toBe(MY_TEAM_PATH);
  });
});
