// League settings (Craig, 22 Oct 2026): reached from "Your leagues" by whoever runs the league,
// beside Player scoring; the odd team out and games a gameweek, saved from the next gameweek, or
// the reason they weren't; and never over someone else's save.

import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { LeagueSettings } from "../../../convex/rules/leagueSettings";
import { settingsPath } from "../../../src/leagueSettings/paths";
import type { SettingsView } from "../../../src/leagueSettings/seam";
import {
  blankGamesWords,
  gamesLabel,
  loadingWords,
  noRulesWords,
  oddTeamOutWords,
  savedWords,
  SETTINGS_TITLE,
} from "../../../src/leagueSettings/words";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { LEAGUES_TITLE } from "../../../src/leagues/words";
import type { Revision } from "../../../src/rules/rulesDraft";
import { gameweekWords, loadLatestWords, overtakenWords, saveWords, unchangedWords } from "../../../src/rules/words";
import { SCORING_TITLE } from "../../../src/scoring/words";
import type { LeagueSettingsData } from "../../support/src/leagueSettings.harness";
import { CHANGES_FROM, REVISION } from "../../support/src/scoring.harness";
import { adminSeeing, coCommissioned, commissioner, league, managerIn, openApp, withNoPart } from "../../support/src/shell.harness";

const PAGE = settingsPath(league.leagueId);
const openSettings = (data: LeagueSettingsData = {}) => openApp(PAGE, commissioner, { leagueSettings: data });
type App = ReturnType<typeof openSettings>;

const gamesBox = () => screen.getByRole("textbox", { name: gamesLabel }) as HTMLInputElement;
const option = (oddTeamOut: keyof typeof oddTeamOutWords) => screen.getByRole("radio", { name: oddTeamOutWords[oddTeamOut] }) as HTMLInputElement;
async function setGames(text: string) {
  await userEvent.clear(gamesBox());
  if (text !== "") await userEvent.type(gamesBox(), text);
}
const save = () => userEvent.click(screen.getByRole("button", { name: saveWords }));
const savedSettings = (app: App): LeagueSettings => app.leagueSettings.save.mock.calls[0][1];

describe("reaching it", () => {
  it.each([
    ["the commissioner", commissioner],
    ["the co-commissioner", managerIn(coCommissioned)],
    ["the admin, with no part in the league", adminSeeing(withNoPart(league))],
  ])("%s opens it from the league's row on Your leagues, beside Player scoring", async (_, session) => {
    const app = openApp(LEAGUES_PATH, session);
    expect(await screen.findByRole("link", { name: SCORING_TITLE })).toBeTruthy();
    await userEvent.click(screen.getByRole("link", { name: SETTINGS_TITLE }));

    expect(await screen.findByRole("heading", { level: 1, name: SETTINGS_TITLE })).toBeTruthy();
    expect(app.path()).toBe(PAGE);
    expect(app.leagueSettings.useSettings).toHaveBeenCalledWith(league.leagueId);
  });

  it("a manager isn't offered it, and is sent back to Your leagues if they go there", async () => {
    openApp(LEAGUES_PATH, managerIn(league));
    await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE });
    expect(screen.queryByRole("link", { name: SETTINGS_TITLE })).toBeNull();

    cleanup();
    const app = openApp(PAGE, managerIn(league));
    await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE });
    expect(app.path()).toBe(LEAGUES_PATH);
  });
});

describe("editing them", () => {
  it("opens on the league's settings, from which gameweek a change applies, and nothing changed yet", async () => {
    openSettings();
    await screen.findByRole("heading", { level: 1, name: SETTINGS_TITLE });

    expect(option("leagueAverage").checked).toBe(true);
    expect(gamesBox().value).toBe("1");
    expect(screen.getByText(gameweekWords(CHANGES_FROM))).toBeTruthy();
    expect(screen.getByText(unchangedWords)).toBeTruthy();
    expect((screen.getByRole("button", { name: saveWords }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("saves both changed, with the rules they were made from, and says from when", async () => {
    const app = openSettings();
    await userEvent.click(await screen.findByRole("radio", { name: oddTeamOutWords.bye }));
    await setGames("2");
    await save();

    expect(app.leagueSettings.save).toHaveBeenCalledExactlyOnceWith(league.leagueId, { oddTeamOut: "bye", gamesPerGameweek: 2 }, REVISION);
    expect((await screen.findByRole("status")).textContent).toBe(savedWords(CHANGES_FROM));
  });

  it("shows why the server refused them", async () => {
    const app = openSettings();
    const refusal = "The head-to-head games each team plays a gameweek must be a whole number, 1 or more, not 1.5.";
    app.leagueSettings.save.mockResolvedValueOnce(refusal);
    await screen.findByRole("heading", { level: 1, name: SETTINGS_TITLE });
    await setGames("1.5");
    await save();

    expect(savedSettings(app).gamesPerGameweek).toBe(1.5);
    expect((await screen.findByRole("alert")).textContent).toBe(refusal);
  });

  it("refuses games a gameweek left without a number itself, and asks the server nothing", async () => {
    const app = openSettings();
    await screen.findByRole("heading", { level: 1, name: SETTINGS_TITLE });
    await setGames("");
    await save();

    expect((await screen.findByRole("alert")).textContent).toBe(blankGamesWords);
    expect(app.leagueSettings.save).not.toHaveBeenCalled();
  });
});

it("keeps the edits when someone else saves, says so, and loads the latest on asking", async () => {
  const app = openSettings();
  await screen.findByRole("heading", { level: 1, name: SETTINGS_TITLE });
  await setGames("2");
  const theirs: SettingsView = { part: { oddTeamOut: "bye", gamesPerGameweek: 3 }, revision: "rules-2" as Revision, changesFrom: CHANGES_FROM };
  app.leagueSettings.useSettings.mockReturnValue(theirs);
  app.becomes({ ...commissioner });
  await waitFor(() => expect(app.leagueSettings.useSettings).toHaveLastReturnedWith(theirs));

  expect(gamesBox().value).toBe("2");
  expect(screen.getByText(overtakenWords)).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: loadLatestWords }));
  expect(gamesBox().value).toBe("3");
  expect(option("bye").checked).toBe(true);
});

describe("while the server answers, or has nothing", () => {
  it("says the settings are loading, to screen readers too", async () => {
    openSettings({ loading: true });
    await screen.findByRole("heading", { level: 1, name: SETTINGS_TITLE });
    expect(screen.getByRole("status").textContent).toBe(loadingWords);
  });

  it("says a league made before rules were held has none to edit", async () => {
    openSettings({ view: null });
    expect(await screen.findByText(noRulesWords)).toBeTruthy();
  });
});
