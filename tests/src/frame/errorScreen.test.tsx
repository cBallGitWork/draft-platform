// A page whose reading throws, such as a query that failed (spec/12, The frame): the page says so in
// the alert strip in plain words, never the server's, even for a refusal; logs it; offers Try
// again, which reads again; and leads back to "Your leagues". Every screen that reads is checked.

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { JOIN_PATH } from "../../../convex/joining/joiningShared";
import type { Session } from "../../../src/signIn/seam";
import { ADMIN_FEEDS_PATH, ADMIN_PATH } from "../../../src/admin/paths";
import { MAIL_PATH, MY_TEAM_PATH, TABLE_PATH } from "../../../src/frame/menu";
import { READ_FAILED_LOG } from "../../../src/frame/ReadFailed";
import { ERROR_PAGE_TITLE, menuWords, readFailedWords, tryAgainWords } from "../../../src/frame/words";
import { gameweeksPath } from "../../../src/gameweeks/paths";
import { invitesPath } from "../../../src/joining/paths";
import { settingsPath } from "../../../src/leagueSettings/paths";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { backToLeaguesWords, LEAGUES_TITLE } from "../../../src/leagues/words";
import { scoringPath } from "../../../src/scoring/paths";
import { squadsPath } from "../../../src/squads/paths";
import { findLabel } from "../../../src/shared/words";
import { silenceConsoleError } from "../../support/console.setup";
import type { JoiningData } from "../../support/src/joining.harness";
import { admin, commissioned, league, manager, managerIn, newcomer, openApp, type AppSetUp } from "../../support/src/shell.harness";

type App = ReturnType<typeof openApp>;

/** Opens the Table from My team, whose reading throws `error`, and waits for the error page. */
async function openTableThrowing(error: unknown) {
  const app = openApp(MY_TEAM_PATH, manager);
  app.table.useLeagueTable.mockImplementation(() => {
    throw error;
  });
  await userEvent.click(await screen.findByRole("link", { name: menuWords.table }));
  expect(await screen.findByRole("heading", { level: 1, name: ERROR_PAGE_TITLE })).toBeTruthy();
  return app;
}

/** Follows the error page's way back, which lands on Your leagues and leaves the error behind. */
async function goBackToLeagues(app: App) {
  await userEvent.click(screen.getByRole("link", { name: backToLeaguesWords }));
  expect(await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE })).toBeTruthy();
  expect(app.path()).toBe(LEAGUES_PATH);
  expect(screen.queryByRole("heading", { name: ERROR_PAGE_TITLE })).toBeNull();
}

/** What the server said, which the manager must never see. */
const serverWords = "[CONVEX Q(table/leagueTable:ofLeague)] Uncaught Error: socket closed";
const refusalWords = "You aren't in this league.";

// React and the router log a caught error too, so every test here silences console.error.

it("says plainly that reading failed, logs it, and leads back to Your leagues", async () => {
  const logged = silenceConsoleError();
  const failure = new Error(serverWords);
  const app = await openTableThrowing(failure);

  expect(screen.getByRole("alert").textContent).toBe(readFailedWords);
  expect(screen.queryByText(serverWords, { exact: false })).toBeNull();
  expect(logged).toHaveBeenCalledWith(READ_FAILED_LOG, failure);

  await goBackToLeagues(app);
});

it("says the same plain words for a refusal, never the server's, and logs it", async () => {
  const logged = silenceConsoleError();
  const refusal = new ConvexError(refusalWords);
  await openTableThrowing(refusal);

  expect(screen.getByRole("alert").textContent).toBe(readFailedWords);
  expect(screen.queryByText(refusalWords, { exact: false })).toBeNull();
  expect(logged).toHaveBeenCalledWith(READ_FAILED_LOG, refusal);
});

it("reads again on Try again, and draws the page in place of the error while the read is on its way", async () => {
  silenceConsoleError();
  const app = await openTableThrowing(new Error(serverWords));
  app.table.useLeagueTable.mockReset();
  app.table.useLeagueTable.mockReturnValue(undefined);

  await userEvent.click(screen.getByRole("button", { name: tryAgainWords }));

  expect(app.table.useLeagueTable).toHaveBeenCalled();
  expect(screen.queryByRole("heading", { name: ERROR_PAGE_TITLE })).toBeNull();
  expect(app.path()).toBe(TABLE_PATH);
});

it("reads again on Try again, and shows the error page again if reading fails again", async () => {
  silenceConsoleError();
  const app = await openTableThrowing(new Error(serverWords));
  app.table.useLeagueTable.mockClear();

  await userEvent.click(screen.getByRole("button", { name: tryAgainWords }));

  expect(app.table.useLeagueTable).toHaveBeenCalled();
  expect(await screen.findByRole("heading", { level: 1, name: ERROR_PAGE_TITLE })).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toBe(readFailedWords);
});

/** Makes the hook a screen reads its data through throw `error`. */
const failing = (error: unknown) => () => {
  throw error;
};

/** Joining's data, each page's read throwing `error` (joining.harness.ts reads it as the page draws). */
const joiningFailing = (error: unknown): JoiningData => ({
  get invitesPage(): never {
    throw error;
  },
  get joinPage(): never {
    throw error;
  },
  get endedInvite(): never {
    throw error;
  },
});

const leagueId = league.leagueId;
const runner = managerIn(commissioned);

/** How a screen's read is made to fail: through the data the app opens with, or by its hook
 *  throwing once the app is open, before the router draws the page; `ask` is what the manager
 *  does before the page reads it, such as searching. */
type Failing = { setUp?: (error: unknown) => AppSetUp; fail?: (app: App, error: unknown) => void; ask?: () => Promise<void> };

/** Types a name into "Find a player", which reads the players found. */
const searchForAPlayer = async () => userEvent.type(await screen.findByRole("searchbox", { name: findLabel }), "Saka");
const joiningFails: Failing = { setUp: (error) => ({ joining: joiningFailing(error) }) };

/** Each screen that reads, where it is, who may open it, and how to make its read fail. The top
 *  bar's reads, above the pages, are checked in liveApp.test.tsx. */
const screensThatRead: [string, string, Session, Failing][] = [
  ["Your leagues, in no league", LEAGUES_PATH, newcomer, joiningFails],
  ["Mail", MAIL_PATH, manager, { fail: (app, error) => app.mail.useLetters.mockImplementation(failing(error)) }],
  ["the Table", TABLE_PATH, manager, { fail: (app, error) => app.table.useLeagueTable.mockImplementation(failing(error)) }],
  ["Invites", invitesPath(leagueId), runner, joiningFails],
  ["an invite link", `${JOIN_PATH}/the-token`, manager, joiningFails],
  ["Gameweeks", gameweeksPath(leagueId), runner, { fail: (app, error) => app.gameweeks.useLeagueGameweeks.mockImplementation(failing(error)) }],
  ["Squads", squadsPath(leagueId), runner, { fail: (app, error) => app.squads.useSquads.mockImplementation(failing(error)) }],
  ["Squads' Find a player", squadsPath(leagueId), runner, { fail: (app, error) => app.squads.useFoundPlayers.mockImplementation((_leagueId, text) => (text.trim() ? failing(error)() : [])), ask: searchForAPlayer }],
  ["Player scoring", scoringPath(leagueId), runner, { fail: (app, error) => app.scoring.useScoring.mockImplementation(failing(error)) }],
  ["League settings", settingsPath(leagueId), runner, { fail: (app, error) => app.leagueSettings.useSettings.mockImplementation(failing(error)) }],
  ["the admin's dashboard", ADMIN_PATH, admin, { fail: (app, error) => app.admin.useQueue.mockImplementation(failing(error)) }],
  ["the admin's Find a player", ADMIN_PATH, admin, { fail: (app, error) => app.admin.useFoundPlayers.mockImplementation((text) => (text.trim() ? failing(error)() : [])), ask: searchForAPlayer }],
  ["the admin's feeds", ADMIN_FEEDS_PATH, admin, { fail: (app, error) => app.admin.useFeeds.mockImplementation(failing(error)) }],
];

describe("no screen shows a failed read as the server's words", () => {
  it.each(screensThatRead)("%s", async (_, path, session, { setUp, fail, ask }) => {
    silenceConsoleError();
    const error = new Error(serverWords);
    const app = openApp(path, session, setUp?.(error));
    fail?.(app, error);
    await ask?.();

    expect(await screen.findByRole("heading", { level: 1, name: ERROR_PAGE_TITLE })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe(readFailedWords);
    expect(screen.getByRole("button", { name: tryAgainWords })).toBeTruthy();
    expect(screen.queryByText(serverWords, { exact: false })).toBeNull();
  });
});
