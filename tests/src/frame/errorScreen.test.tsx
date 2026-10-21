// A page whose reading throws, such as a query the server refused (F72): the page says why in the
// plate's look, the server's own words for a refusal and plain words for anything else, which is
// logged, and leads back to "Your leagues".

import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { afterEach, expect, it, vi } from "vitest";
import { LEAGUES_PATH, LEAGUES_TITLE } from "../../../src/leagues/paths";
import { manager, openApp } from "../../support/src/shell.harness";
import { MY_TEAM_PATH } from "../../../src/frame/menu";
import { ERROR_PAGE_TITLE, readFailedWords } from "../../../src/frame/words";

afterEach(cleanup);

/** Opens the Table from My team, whose reading throws `error`, and waits for the error page. */
async function openTableThrowing(error: unknown) {
  const app = openApp(MY_TEAM_PATH, manager);
  app.table.useLeagueTable.mockImplementation(() => {
    throw error;
  });
  await userEvent.click(await screen.findByRole("link", { name: "Table" }));
  expect(await screen.findByRole("heading", { level: 1, name: ERROR_PAGE_TITLE })).toBeTruthy();
  return app;
}

/** Follows the error page's way back, which lands on Your leagues and leaves the error behind. */
async function goBackToLeagues(app: ReturnType<typeof openApp>) {
  await userEvent.click(screen.getByRole("link", { name: "Back to your leagues" }));
  expect(await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE })).toBeTruthy();
  expect(app.path()).toBe(LEAGUES_PATH);
  expect(screen.queryByRole("heading", { name: ERROR_PAGE_TITLE })).toBeNull();
}

const refusalWords = "You aren't in this league.";
const loggedAs = "Drawing the page failed:";

/** React and the router report a caught error too; a test keeps that quiet and sees what was logged. */
const quietConsole = () => vi.spyOn(console, "error").mockImplementation(() => {});

it("shows the server's own words when it refuses, and leads back to Your leagues", async () => {
  quietConsole();
  const app = await openTableThrowing(new ConvexError(refusalWords));

  expect(screen.getByRole("alert").textContent).toBe(refusalWords);

  await goBackToLeagues(app);
});

it("says plainly that anything else went wrong, logs it, and leads back to Your leagues", async () => {
  const logged = quietConsole();
  const failure = new Error("socket closed");
  const app = await openTableThrowing(failure);

  expect(screen.getByRole("alert").textContent).toBe(readFailedWords);
  expect(logged).toHaveBeenCalledWith(loggedAs, failure);

  await goBackToLeagues(app);
});

it("doesn't log a refusal as a failure", async () => {
  const logged = quietConsole();
  await openTableThrowing(new ConvexError(refusalWords));

  expect(logged).not.toHaveBeenCalledWith(loggedAs, expect.anything());
});
