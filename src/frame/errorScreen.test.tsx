// A page whose reading throws, such as a query the server refused (F72): the page says why in the
// plate's look, the server's own words for a refusal and plain words for anything else, which is
// logged, and leads back to "Your leagues".

import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { afterEach, expect, it, vi } from "vitest";
import { LEAGUES_PATH, LEAGUES_TITLE } from "../leagues/paths";
import { manager, openApp } from "../shell.harness";
import { MY_TEAM_PATH } from "./menu";
import { ERROR_PAGE_TITLE, readFailedWords } from "./words";

afterEach(cleanup);

/** The app at My team, whose Table, once opened, reads by throwing `error`. */
async function openTableThrowing(error: unknown) {
  const app = openApp(MY_TEAM_PATH, manager);
  app.table.useLeagueTable.mockImplementation(() => {
    throw error;
  });
  await userEvent.click(await screen.findByRole("link", { name: "Table" }));
  return app;
}

/** React and the router report a caught error too; a test keeps that quiet and sees what was logged. */
const quietConsole = () => vi.spyOn(console, "error").mockImplementation(() => {});

it("shows the server's own words when it refuses, and leads back to Your leagues", async () => {
  quietConsole();
  const app = await openTableThrowing(new ConvexError("You aren't in this league."));

  expect(await screen.findByRole("heading", { level: 1, name: ERROR_PAGE_TITLE })).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toBe("You aren't in this league.");

  await userEvent.click(screen.getByRole("link", { name: "Back to your leagues" }));
  expect(await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE })).toBeTruthy();
  expect(app.path()).toBe(LEAGUES_PATH);
  expect(screen.queryByRole("heading", { name: ERROR_PAGE_TITLE })).toBeNull();
});

it("says plainly that anything else went wrong, logs it, and leads back to Your leagues", async () => {
  const logged = quietConsole();
  const failure = new Error("socket closed");
  const app = await openTableThrowing(failure);

  expect(await screen.findByRole("heading", { level: 1, name: ERROR_PAGE_TITLE })).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toBe(readFailedWords);
  expect(logged).toHaveBeenCalledWith("Drawing the page failed:", failure);

  await userEvent.click(screen.getByRole("link", { name: "Back to your leagues" }));
  expect(await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE })).toBeTruthy();
  expect(app.path()).toBe(LEAGUES_PATH);
});

it("doesn't log a refusal as a failure", async () => {
  const logged = quietConsole();
  await openTableThrowing(new ConvexError("You aren't in this league."));
  await screen.findByRole("heading", { level: 1, name: ERROR_PAGE_TITLE });

  expect(logged).not.toHaveBeenCalledWith("Drawing the page failed:", expect.anything());
});
