// League settings (Craig, 22 Oct 2026): reached from "Your leagues" by whoever runs the league,
// beside Player scoring; the odd team out and games a gameweek, saved from the next gameweek, or
// the reason they weren't; and never over someone else's save. The squad's make-up (#341) is in
// leagueSettings.squad.test.tsx.

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SETTINGS_DRAFT_HASH } from "../../../src/leagueSettings/paths";
import type { SettingsView } from "../../../src/leagueSettings/seam";
import {
  blankGamesWords,
  draftTitle,
  fixturesTitle,
  gamesHint,
  gamesLabel,
  loadingWords,
  oddTeamOutWords,
  redrawWords,
  savedWords,
  SETTINGS_TABS,
  SETTINGS_TITLE,
  settingsTabsLabel,
  settingsTabWords,
  squadMaximumLabel,
  squadTitle,
  teamOrderTitle,
} from "../../../src/leagueSettings/words";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { WAIVER_ORDER_TITLE } from "../../../src/myTeam/claims/words";
import type { Revision } from "../../../src/rules/rulesEdits";
import { discardWords, gameweekWords, loadLatestWords, overtakenWords, saveWords, unchangedWords } from "../../../src/rules/words";
import { SCORING_TITLE } from "../../../src/scoring/words";
import { PL_GAMEWEEKS } from "../../support/convex/footballRows.harness";
import { REVISION } from "../../support/src/leagueSettings.harness";
import { box, fill, FIRST_SETTINGS, openedOn, openedSettings, openSettings, openTab, save, saveButton, savedSettings, SETTINGS_PAGE } from "../../support/src/leagueSettingsScreen.harness";
import { CHANGES_FROM } from "../../support/src/scoring.harness";
import { descriptionOf, refusalBeside } from "../../support/src/describedBy";
import { adminSeeing, coCommissioned, commissioner, expectNotOffered, expectSentToLeagues, league, managerIn, openApp, withNoPart } from "../../support/src/shell.harness";

const gamesBox = () => box(gamesLabel);
const option = (oddTeamOut: keyof typeof oddTeamOutWords) => screen.getByRole("radio", { name: oddTeamOutWords[oddTeamOut] }) as HTMLInputElement;
const setGames = (text: string) => fill(gamesLabel, text);

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
    expect(app.path()).toBe(SETTINGS_PAGE);
    expect(app.leagueSettings.useSettings).toHaveBeenCalledWith(league.leagueId);
  });

  it("a manager isn't offered it, and is sent back to Your leagues if they go there", async () => {
    await expectNotOffered(SETTINGS_TITLE, managerIn(league));
    await expectSentToLeagues(SETTINGS_PAGE, managerIn(league));
  });
});

describe("its tabs (#1034, the approved pictures)", () => {
  const tabs = () => within(screen.getByRole("group", { name: settingsTabsLabel })).getAllByRole("button");
  const region = (name: string) => screen.queryByRole("region", { name });

  it("shows Fixtures, Squad, Draft, Waivers, Trades and Draft order on the title plate, opening on Fixtures, with the league's name", async () => {
    await openedSettings();

    expect(tabs().map((tab) => tab.textContent)).toEqual(SETTINGS_TABS.map((tab) => settingsTabWords[tab]));
    expect(tabs().filter((tab) => tab.getAttribute("aria-pressed") === "true").map((tab) => tab.textContent)).toEqual([settingsTabWords.fixtures]);
    expect(region(fixturesTitle)).toBeTruthy();
    expect(region(squadTitle)).toBeNull();
    expect(within(screen.getByRole("heading", { level: 1 }).parentElement!).getByText(league.name)).toBeTruthy();
  });

  it("keeps the edits as the tabs switch, and one Save sends them all", async () => {
    const app = await openedSettings();
    await setGames("2");
    await openTab("squad");
    await fill(squadMaximumLabel, "20");
    await openTab("fixtures");
    expect(gamesBox().value).toBe("2");
    await save();

    expect(app.leagueSettings.save).toHaveBeenCalledExactlyOnceWith(league.leagueId, { ...FIRST_SETTINGS, gamesPerGameweek: 2, squadMaximum: 20 }, REVISION);
  });

  it("shows the waiver order beside Waivers only, and no Save bar on Draft order, whose moves save at once", async () => {
    await openedOn("waivers");
    expect(await screen.findByRole("region", { name: WAIVER_ORDER_TITLE })).toBeTruthy();

    await openTab("draftOrder");
    expect(region(WAIVER_ORDER_TITLE)).toBeNull();
    expect(region(teamOrderTitle)).toBeTruthy();
    expect(screen.queryByRole("button", { name: saveWords })).toBeNull();
  });

  it("opens on Draft from the draft room's Change the start (#1476)", async () => {
    openApp(`${SETTINGS_PAGE}#${SETTINGS_DRAFT_HASH}`, commissioner);

    expect(await screen.findByRole("region", { name: draftTitle })).toBeTruthy();
    expect(region(fixturesTitle)).toBeNull();
  });
});

describe("editing them", () => {
  it("opens on the league's settings, from which gameweek a change applies, and nothing changed yet", async () => {
    await openedSettings();

    expect(option("leagueAverage").checked).toBe(true);
    expect(gamesBox().value).toBe("1");
    expect(screen.getByText(gameweekWords(CHANGES_FROM))).toBeTruthy();
    expect(screen.getByText(unchangedWords)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it("says saving redraws the fixtures only from the gameweek it applies from (#266)", async () => {
    openSettings();
    expect(await screen.findByText(redrawWords)).toBeTruthy();
  });

  it("saves both changed, with the rules they were made from, and says from when", async () => {
    const app = openSettings();
    await userEvent.click(await screen.findByRole("radio", { name: oddTeamOutWords.bye }));
    await setGames("2");
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");
    await save();

    expect(app.leagueSettings.save).toHaveBeenCalledExactlyOnceWith(league.leagueId, { ...FIRST_SETTINGS, oddTeamOut: "bye", gamesPerGameweek: 2 }, REVISION);
    // The live region was in the page, empty, before the save, so the words are announced.
    await waitFor(() => expect(status.textContent).toBe(savedWords(CHANGES_FROM)));
    expect(screen.getByRole("status")).toBe(status);
  });

  it("shows why the server refused them in the save bar, the cursor left on Save (#645)", async () => {
    const app = await openedSettings();
    const refusal = "The head-to-head games each team plays a gameweek must be a whole number, 1 or more, not 1.5.";
    app.leagueSettings.save.mockResolvedValueOnce(refusal);
    await setGames("1.5");
    await save();

    expect(savedSettings(app).gamesPerGameweek).toBe(1.5);
    expect((await screen.findByRole("alert")).textContent).toBe(refusal);
    expect(document.activeElement).toBe(saveButton());
    expect(refusalBeside(gamesBox())).toBeNull();
    // Under the save bar, after Save, as before.
    expect(saveButton().compareDocumentPosition(screen.getByRole("alert")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("refuses games a gameweek left without a number itself, beside the box, and asks the server nothing (#645)", async () => {
    const app = await openedSettings();
    await setGames("");
    await save();

    expect((await screen.findByRole("alert")).textContent).toBe(blankGamesWords);
    expect(refusalBeside(gamesBox())).toBe(blankGamesWords);
    expect(app.leagueSettings.save).not.toHaveBeenCalled();
  });

  it("takes the refusal beside a box away once it holds a number, or the changes are discarded (#645)", async () => {
    await openedSettings();
    await setGames("");
    await save();
    await screen.findByRole("alert");
    await setGames("2");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(descriptionOf(gamesBox())).toBe(gamesHint);

    await setGames("");
    await save();
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: discardWords }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

it("keeps the edits when someone else saves, says so, and loads the latest on asking", async () => {
  const app = await openedSettings();
  await setGames("2");
  const theirs: SettingsView = { part: { ...FIRST_SETTINGS, oddTeamOut: "bye", gamesPerGameweek: 3 }, revision: "rules-2" as Revision, changesFrom: CHANGES_FROM, seasonGameweeks: PL_GAMEWEEKS };
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
    await openedSettings({ loading: true });
    expect(screen.getByRole("status").textContent).toBe(loadingWords);
  });

  it("keeps an unsaved edit while the next minute's settings load (#1534)", async () => {
    const app = await openedSettings();
    await setGames("2");
    app.leagueSettings.useSettings.mockReturnValue(undefined);
    app.becomes({ ...commissioner });
    await waitFor(() => expect(app.leagueSettings.useSettings).toHaveLastReturnedWith(undefined));

    expect(screen.queryByText(loadingWords)).toBeNull();
    expect(gamesBox().value).toBe("2");
    expect(saveButton().disabled).toBe(false);
  });
});
