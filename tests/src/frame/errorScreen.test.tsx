// A page whose reading throws, such as a query that failed (spec/12, The frame): the page says so in
// the alert strip in plain words, never the server's, even for a refusal; logs it; offers Retry,
// which reads again; and leads back to "Your leagues". Every route that reads is checked, and a new
// route that isn't fails the check (#2136).

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { JOIN_PATH } from "../../../convex/joining/joiningShared";
import type { Session } from "../../../src/signIn/seam";
import { ADMIN_AVAILABILITY_PATH, ADMIN_FEEDBACK_PATH, ADMIN_FEEDS_PATH, ADMIN_PATH } from "../../../src/admin/paths";
import { FEEDBACK_PATH } from "../../../src/feedback/paths";
import {
  DRAFT_PATH,
  HOME_NEWS_PATH,
  HOME_PATH,
  MAIL_PATH,
  MATCHUP_PATH,
  MY_TEAM_FIXTURES_PATH,
  MY_TEAM_PATH,
  MY_TEAM_SQUAD_PATH,
  MY_TEAM_TRANSACTIONS_PATH,
  PREMIER_LEAGUE_PATH,
  SCOUTING_PATH,
  TABLE_PATH,
  TRADES_NEW_PATH,
  TRADES_PATH,
} from "../../../src/frame/menu";
import { READ_FAILED_LOG } from "../../../src/frame/ReadFailed";
import { ERROR_PAGE_TITLE, readFailedWords, retryWords } from "../../../src/frame/words";
import { gameweeksPath } from "../../../src/gameweeks/paths";
import { RECAP_PATH } from "../../../src/home/paths";
import { invitesPath } from "../../../src/joining/paths";
import { settingsPath } from "../../../src/leagueSettings/paths";
import { LEAGUES_PATH, NEW_LEAGUE_PATH } from "../../../src/leagues/paths";
import { backToLeaguesWords } from "../../../src/leagues/words";
import { otherTeamPath } from "../../../src/myTeam/paths";
import { PATCH_NOTES_PATH } from "../../../src/patches/paths";
import { playerCardPath } from "../../../src/playerCard/paths";
import { clubPath, matchPath } from "../../../src/premierLeague/paths";
import { createShellRouter, type ShellContext } from "../../../src/routes/router";
import { frameRoute, LANDING_PATH, leaguePagesRoute } from "../../../src/routes/root";
import { scoringPath } from "../../../src/scoring/paths";
import { SIGN_IN_PATH } from "../../../src/signIn/paths";
import { squadsPath } from "../../../src/squads/paths";
import { findLabel, menuWords } from "../../../src/shared/words";
import { silenceConsoleError } from "../../support/console.setup";
import type { JoiningData } from "../../support/src/joining.harness";
import { routerPaths, routesNotReached } from "../../support/src/routerPaths";
import { admin, commissioned, league, manager, managerIn, newcomer, openApp, type AppSetUp, yourLeaguesHeading } from "../../support/src/shell.harness";

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
  expect(await yourLeaguesHeading()).toBeTruthy();
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

// Craig, 31 Oct 2026 (#489): no guess at the cause, such as the connection, and a Retry button;
// the buttons sit inside the panel's padding, not on its bottom edge (a margin collapses out of it).
it("says only that something went wrong, offers Retry, and pads its buttons inside the panel", async () => {
  silenceConsoleError();
  await openTableThrowing(new Error(serverWords));

  expect(screen.getByRole("alert").textContent).toBe("Something went wrong");
  const retry = screen.getByRole("button", { name: "Retry" });
  const buttonRow = retry.parentElement!;
  expect(buttonRow.classList.contains("p-3")).toBe(true);
  expect(buttonRow.className).not.toMatch(/\bm[by]?-/);
});

it("says the same plain words for a refusal, never the server's, and logs it", async () => {
  const logged = silenceConsoleError();
  const refusal = new ConvexError(refusalWords);
  await openTableThrowing(refusal);

  expect(screen.getByRole("alert").textContent).toBe(readFailedWords);
  expect(screen.queryByText(refusalWords, { exact: false })).toBeNull();
  expect(logged).toHaveBeenCalledWith(READ_FAILED_LOG, refusal);
});

it("reads again on Retry, and draws the page in place of the error while the read is on its way", async () => {
  silenceConsoleError();
  const app = await openTableThrowing(new Error(serverWords));
  app.table.useLeagueTable.mockReset();
  app.table.useLeagueTable.mockReturnValue(undefined);

  await userEvent.click(screen.getByRole("button", { name: retryWords }));

  expect(app.table.useLeagueTable).toHaveBeenCalled();
  expect(screen.queryByRole("heading", { name: ERROR_PAGE_TITLE })).toBeNull();
  expect(app.path()).toBe(TABLE_PATH);
});

it("reads again on Retry, and shows the error page again if reading fails again", async () => {
  silenceConsoleError();
  const app = await openTableThrowing(new Error(serverWords));
  app.table.useLeagueTable.mockClear();

  await userEvent.click(screen.getByRole("button", { name: retryWords }));

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
  ["the admin's Feedback", ADMIN_FEEDBACK_PATH, admin, { fail: (app, error) => app.feedback.useFeedbackList.mockImplementation(failing(error)) }],
  ["the admin's Availability", ADMIN_AVAILABILITY_PATH, admin, { fail: (app, error) => app.admin.useSetByHand.mockImplementation(failing(error)) }],
  ["League home", HOME_PATH, manager, { fail: (app, error) => app.home.useLeagueHome.mockImplementation(failing(error)) }],
  ["League home's News", HOME_NEWS_PATH, manager, { fail: (app, error) => app.home.useLeagueNews.mockImplementation(failing(error)) }],
  ["the recap", RECAP_PATH, manager, { fail: (app, error) => app.home.useRecap.mockImplementation(failing(error)) }],
  ["Scouting", SCOUTING_PATH, manager, { fail: (app, error) => app.scouting.usePlayersList.mockImplementation(failing(error)) }],
  ["the draft room", DRAFT_PATH, manager, { fail: (app, error) => app.draft.useDraft.mockImplementation(failing(error)) }],
  ["Tactics", MY_TEAM_PATH, manager, { fail: (app, error) => app.myTeam.useTactics.mockImplementation(failing(error)) }],
  ["My team's Squad", MY_TEAM_SQUAD_PATH, manager, { fail: (app, error) => app.myTeam.useTeamSquad.mockImplementation(failing(error)) }],
  ["My team's Fixtures", MY_TEAM_FIXTURES_PATH, manager, { fail: (app, error) => app.myTeam.useTeamFixtures.mockImplementation(failing(error)) }],
  ["My team's Transactions", MY_TEAM_TRANSACTIONS_PATH, manager, { fail: (app, error) => app.myTeam.useTeamTransactions.mockImplementation(failing(error)) }],
  ["another team's squad", otherTeamPath(leagueId, "team-2"), manager, { fail: (app, error) => app.myTeam.useOtherSquad.mockImplementation(failing(error)) }],
  ["the matchup", MATCHUP_PATH, manager, { fail: (app, error) => app.matchup.useMatchup.mockImplementation(failing(error)) }],
  ["the Premier League", PREMIER_LEAGUE_PATH, manager, { fail: (app, error) => app.premierLeague.useStandings.mockImplementation(failing(error)) }],
  ["a match", matchPath(1), manager, { fail: (app, error) => app.premierLeague.useMatch.mockImplementation(failing(error)) }],
  ["a club", clubPath(3), manager, { fail: (app, error) => app.premierLeague.useClub.mockImplementation(failing(error)) }],
  ["Trades' Offers", TRADES_PATH, manager, { fail: (app, error) => app.trades.useTrades.mockImplementation(failing(error)) }],
  ["Trades' New offer", TRADES_NEW_PATH, manager, { fail: (app, error) => app.trades.useTrades.mockImplementation(failing(error)) }],
  ["a player's card", playerCardPath(leagueId, 1), manager, { fail: (app, error) => app.playerCard.usePlayerCard.mockImplementation(failing(error)) }],
  ["the patch notes", PATCH_NOTES_PATH, manager, { fail: (app, error) => app.patches.useNotes.mockImplementation(failing(error)) }],
];

/** Routes that read nothing the server could fail to send, each with why. */
const READS_NOTHING: ReadonlyMap<string, string> = new Map([
  [LANDING_PATH, "it redirects to My team, whose read is checked above"],
  [SIGN_IN_PATH, "it reads nothing: asking for a link says its own failure (liveApp.test.tsx)"],
  [NEW_LEAGUE_PATH, "it reads nothing: creating a league says its own failure"],
  [FEEDBACK_PATH, "it reads nothing: sending says its own failure"],
]);

describe("no screen shows a failed read as the server's words", () => {
  it.each(screensThatRead)("%s", async (_, path, session, { setUp, fail, ask }) => {
    const logged = silenceConsoleError();
    const error = new Error(serverWords);
    const app = openApp(path, session, setUp?.(error));
    fail?.(app, error);
    await ask?.();

    expect(await screen.findByRole("heading", { level: 1, name: ERROR_PAGE_TITLE })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe(readFailedWords);
    expect(screen.getByRole("button", { name: retryWords })).toBeTruthy();
    expect(screen.queryByText(serverWords, { exact: false })).toBeNull();
    // The page failed on the read made to fail, not on something else.
    expect(logged).toHaveBeenCalledWith(READ_FAILED_LOG, error);
  });
});

describe("every route", () => {
  it("that reads is checked above, but those listed with a reason", () => {
    const unchecked = routesNotReached(screensThatRead.map(([, path]) => path), READS_NOTHING);
    expect(unchecked, "routes no screensThatRead entry opens: add each, or to READS_NOTHING with why").toEqual([]);
  });

  it("listed as reading nothing is one the router has", () => {
    expect([...READS_NOTHING.keys()].filter((route) => !routerPaths.includes(route))).toEqual([]);
  });

  // The two parents' errorComponent turns a thrown read into the error page; sign-in, for the
  // signed-out visitor, reads nothing.
  it("sits under one of the two parents that show the error page, but sign-in", () => {
    const parents: unknown[] = [leaguePagesRoute, frameRoute];
    const orphans = Object.entries(createShellRouter({} as ShellContext).routesByPath)
      .filter(([path, route]) => path !== SIGN_IN_PATH && !parents.includes(route.parentRoute))
      .map(([path]) => path);
    expect(orphans).toEqual([]);
  });
});
