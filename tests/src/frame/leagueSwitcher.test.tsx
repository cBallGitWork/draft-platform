// The top bar's league switcher (#76, spec/13, Several leagues): a manager in several leagues
// switches between them from a list in the top bar, and the app opens in the one used last.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { refusals } from "../../../convex/shared/leagueAccess";
import { ESCAPE_KEY } from "../../../src/shared/browserEvents";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { LEAGUES_TITLE } from "../../../src/leagues/words";
import { READ_FAILED_LOG } from "../../../src/frame/ReadFailed";
import { SIGN_IN_PATH } from "../../../src/signIn/paths";
import { silenceConsoleError } from "../../support/console.setup";
import {
  adminSeeing,
  beingDeleted,
  commissioner,
  league,
  manager,
  managerIn,
  miniBeta,
  openApp,
  visitor,
  withNoPart,
} from "../../support/src/shell.harness";
import { MY_TEAM_PATH } from "../../../src/frame/menu";
import { allLeaguesWords, currentLeagueLabel, ERROR_PAGE_TITLE, signOutWords } from "../../../src/frame/words";

const inTwo = managerIn(league, miniBeta);
const inMiniBeta = { ...inTwo, currentLeagueId: miniBeta.leagueId };

const SWITCHER_NAME = new RegExp(`^${currentLeagueLabel} `);
const switcher = () => screen.findByRole("button", { name: SWITCHER_NAME });
const switcherOrName = async () => within(await screen.findByRole("banner")).findByText(league.name);
const choices = () => within(screen.getByRole("list", { name: LEAGUES_TITLE })).getAllByRole("button");
const miniBetaChoice = () => screen.getByRole("button", { name: /^Mini beta/ });
type Closer = [way: string, close: () => Promise<unknown>];
const closersBesideTheSwitcher: Closer[] = [
  [ESCAPE_KEY, () => userEvent.keyboard(`{${ESCAPE_KEY}}`)],
  ["a tap on the page", () => userEvent.click(screen.getByRole("heading", { level: 1 }))],
];

describe("a manager in two leagues", () => {
  it("opening the app is in the league they used last, named in the top bar", async () => {
    const app = openApp("/", inMiniBeta);
    expect((await switcher()).textContent).toBe(`${currentLeagueLabel} ${miniBeta.name}`);
    expect(app.path()).toBe(MY_TEAM_PATH);
  });

  it("opens the list, seeing each league with their team or part, the one they're in marked", async () => {
    openApp(MY_TEAM_PATH, inTwo);
    await userEvent.click(await switcher());

    expect(choices().map((choice) => choice.textContent)).toEqual(["Tim Hortons Pro LeagueTeam 1", "Mini betaCommissioner"]);
    expect(within(screen.getByRole("list", { name: LEAGUES_TITLE })).getByRole("button", { current: true }).textContent).toBe(
      "Tim Hortons Pro LeagueTeam 1",
    );
    expect((await switcher()).getAttribute("aria-expanded")).toBe("true");
  });

  it("switches to the other league, staying on the page, and the top bar names it once the app is in it", async () => {
    const app = openApp("/team/squad", inTwo);
    await userEvent.click(await switcher());
    await userEvent.click(miniBetaChoice());

    expect(app.leagues.switchLeague).toHaveBeenCalledWith(miniBeta.leagueId);
    expect(screen.queryByRole("list", { name: LEAGUES_TITLE })).toBeNull();
    app.becomes(inMiniBeta);
    expect((await switcher()).textContent).toBe(`${currentLeagueLabel} ${miniBeta.name}`);
    expect(app.path()).toBe("/team/squad");
  });

  it("picking the league they're already in closes the list without asking the server", async () => {
    const app = openApp(MY_TEAM_PATH, inTwo);
    await userEvent.click(await switcher());
    await userEvent.click(screen.getByRole("button", { current: true }));

    expect(app.leagues.switchLeague).not.toHaveBeenCalled();
    expect(screen.queryByRole("list", { name: LEAGUES_TITLE })).toBeNull();
  });

  it("is told why a switch was refused, with the list still open", async () => {
    const app = openApp(MY_TEAM_PATH, inTwo);
    app.leagues.switchLeague.mockResolvedValue(refusals.notInLeague);
    await userEvent.click(await switcher());
    await userEvent.click(miniBetaChoice());

    expect((await screen.findByRole("alert")).textContent).toBe(refusals.notInLeague);
    expect(choices()).toHaveLength(2);
  });

  it.each<Closer>([
    ["the switcher", async () => userEvent.click(await switcher())],
    ...closersBesideTheSwitcher,
  ])("reopening the list after a refused switch, closed with %s, shows no old refusal", async (_, close) => {
    const app = openApp(MY_TEAM_PATH, inTwo);
    app.leagues.switchLeague.mockResolvedValue(refusals.notInLeague);
    await userEvent.click(await switcher());
    await userEvent.click(miniBetaChoice());
    await screen.findByRole("alert");

    await close();
    expect(screen.queryByRole("list", { name: LEAGUES_TITLE })).toBeNull();
    await userEvent.click(await switcher());

    expect(choices()).toHaveLength(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("can't switch twice while the first is on its way", async () => {
    const app = openApp(MY_TEAM_PATH, inTwo);
    app.leagues.switchLeague.mockReturnValue(new Promise(() => {}));
    await userEvent.click(await switcher());
    await userEvent.click(miniBetaChoice());

    expect(choices().every((choice) => (choice as HTMLButtonElement).disabled)).toBe(true);
  });

  it.each(closersBesideTheSwitcher)("closes the list with %s, switching nothing", async (_, close) => {
    const app = openApp(MY_TEAM_PATH, inTwo);
    await userEvent.click(await switcher());
    await close();

    expect(screen.queryByRole("list", { name: LEAGUES_TITLE })).toBeNull();
    expect(app.leagues.switchLeague).not.toHaveBeenCalled();
  });

  it("reaches all their leagues from the list", async () => {
    const app = openApp(MY_TEAM_PATH, inTwo);
    await userEvent.click(await switcher());
    await userEvent.click(screen.getByRole("link", { name: allLeaguesWords }));

    expect(await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE })).toBeTruthy();
    expect(app.path()).toBe(LEAGUES_PATH);
    expect(screen.queryByRole("list", { name: LEAGUES_TITLE })).toBeNull();
  });
});

describe("the top bar's league, for someone in one", () => {
  it("is the league's plain name, with nothing to switch, when they run no team in it", async () => {
    openApp(MY_TEAM_PATH, commissioner);
    const main = await screen.findByRole("banner");
    expect(within(main).getByText(league.name)).toBeTruthy();
    expect(screen.queryByRole("button", { name: SWITCHER_NAME })).toBeNull();
  });

  it("opens to the one league for a manager, so they can leave it (spec/13, Leaving)", async () => {
    openApp(MY_TEAM_PATH, manager);
    await userEvent.click(await switcher());
    expect(choices().map((choice) => choice.textContent)).toEqual(["Tim Hortons Pro LeagueTeam 1"]);
  });

  it("leaves out a league they're deleting, which is frozen", async () => {
    openApp(MY_TEAM_PATH, managerIn(league, beingDeleted(miniBeta)));
    await userEvent.click(await switcher());
    expect(choices().map((choice) => choice.textContent)).toEqual(["Tim Hortons Pro LeagueTeam 1"]);
  });

  it("is the admin's own league alone, not those he only oversees", async () => {
    openApp(MY_TEAM_PATH, { ...adminSeeing(league, { ...miniBeta, roles: [] }), inLeague: true, currentLeagueId: league.leagueId });
    await userEvent.click(await switcher());
    expect(choices().map((choice) => choice.textContent)).toEqual(["Tim Hortons Pro LeagueTeam 1"]);
  });
});

describe("the leagues to switch between (#207)", () => {
  it("are the server's list, leaving out a league it leaves out", async () => {
    openApp(MY_TEAM_PATH, { ...inTwo, switchableLeagueIds: [league.leagueId] });
    await userEvent.click(await switcher());
    expect(choices().map((choice) => choice.textContent)).toEqual(["Tim Hortons Pro LeagueTeam 1"]);
  });

  // The switcher's old rule (a part, and not being deleted) dropped each of these.
  it.each([
    { kept: "one they have no part in", other: withNoPart(miniBeta), otherChoice: "Mini beta" },
    { kept: "one being deleted", other: beingDeleted(miniBeta), otherChoice: "Mini betaCommissioner" },
  ])("are the server's list, which the switcher doesn't judge again: it keeps $kept", async ({ other, otherChoice }) => {
    openApp(MY_TEAM_PATH, { ...managerIn(league, other), switchableLeagueIds: [league.leagueId, other.leagueId] });
    await userEvent.click(await switcher());
    expect(choices().map((choice) => choice.textContent)).toEqual(["Tim Hortons Pro LeagueTeam 1", otherChoice]);
  });

  // signIn/account:signedInAs never sends this: the app is always in one of the leagues it lists.
  it.each([MY_TEAM_PATH, LEAGUES_PATH])(
    "leaving out the one the app is in is a loud error at %s, where Sign out still leads out",
    async (path) => {
      const logged = silenceConsoleError();
      const app = openApp(path, { ...inTwo, switchableLeagueIds: [miniBeta.leagueId] });

      expect(await screen.findByRole("heading", { level: 1, name: ERROR_PAGE_TITLE })).toBeTruthy();
      expect(logged).toHaveBeenCalledWith(READ_FAILED_LOG, new Error(`The league the app is in, ${league.leagueId}, isn't one of manager@example.com's`));
      await userEvent.click(screen.getByRole("button", { name: signOutWords }));
      expect(app.auth.signOut).toHaveBeenCalledOnce();

      app.becomes(visitor);
      expect(await screen.findByRole("textbox", { name: "Email" })).toBeTruthy();
      expect(app.path()).toBe(SIGN_IN_PATH);
    },
  );
});

describe("a league deleted under someone on its pages", () => {
  it("takes them to their leagues, not a broken page", async () => {
    const app = openApp(MY_TEAM_PATH, manager);
    await switcherOrName();
    app.becomes({ ...manager, inLeague: false, leagues: [], switchableLeagueIds: [], currentLeagueId: null });

    expect(await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE })).toBeTruthy();
    expect(app.path()).toBe(LEAGUES_PATH);
  });
});
