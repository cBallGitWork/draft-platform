// League settings (Craig, 22 Oct 2026): reached from "Your leagues" by whoever runs the league,
// beside Player scoring; the odd team out, games a gameweek and the squad's make-up (#341), saved from the next gameweek, or
// the reason they weren't; and never over someone else's save.

import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AREAS } from "../../../convex/lineup/pitch";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { leagueSettingsOf, type LeagueSettings } from "../../../convex/rules/leagueSettingsPart";
import { settingsPath } from "../../../src/leagueSettings/paths";
import type { SettingsView } from "../../../src/leagueSettings/seam";
import {
  areaMinimumLabel,
  blankAreaMinimumWords,
  blankClubMaximumWords,
  blankGamesWords,
  blankSquadMaximumWords,
  clubMaximumLabel,
  clubMaximumWords,
  gamesLabel,
  loadingWords,
  noRulesWords,
  noSquadSizeWords,
  oddTeamOutWords,
  redrawWords,
  savedWords,
  SETTINGS_TITLE,
  squadMaximumLabel,
} from "../../../src/leagueSettings/words";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { LEAGUES_TITLE } from "../../../src/leagues/words";
import type { Revision } from "../../../src/rules/rulesDraft";
import { gameweekWords, loadLatestWords, overtakenWords, saveWords, unchangedWords } from "../../../src/rules/words";
import { SCORING_TITLE } from "../../../src/scoring/words";
import { REVISION, type LeagueSettingsData } from "../../support/src/leagueSettings.harness";
import { CHANGES_FROM } from "../../support/src/scoring.harness";
import { adminSeeing, coCommissioned, commissioner, league, managerIn, openApp, withNoPart } from "../../support/src/shell.harness";

const PAGE = settingsPath(league.leagueId);
/** The settings the fake server holds unless a test says otherwise: the first rules'. */
const FIRST = leagueSettingsOf(FIRST_RULES);
const openSettings = (data: LeagueSettingsData = {}) => openApp(PAGE, commissioner, { leagueSettings: data });
type App = ReturnType<typeof openSettings>;

const gamesBox = () => screen.getByRole("textbox", { name: gamesLabel }) as HTMLInputElement;
const option = (oddTeamOut: keyof typeof oddTeamOutWords) => screen.getByRole("radio", { name: oddTeamOutWords[oddTeamOut] }) as HTMLInputElement;
const box = (name: string) => screen.getByRole("textbox", { name }) as HTMLInputElement;
async function fill(name: string, text: string) {
  await userEvent.clear(box(name));
  if (text !== "") await userEvent.type(box(name), text);
}
const setGames = (text: string) => fill(gamesLabel, text);
const clubTick = () => screen.getByRole("checkbox", { name: clubMaximumWords }) as HTMLInputElement;
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

    expect(app.leagueSettings.save).toHaveBeenCalledExactlyOnceWith(league.leagueId, { ...FIRST, oddTeamOut: "bye", gamesPerGameweek: 2 }, REVISION);
    // The live region was in the page, empty, before the save, so the words are announced.
    await waitFor(() => expect(status.textContent).toBe(savedWords(CHANGES_FROM)));
    expect(screen.getByRole("status")).toBe(status);
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

describe("the squad (#341)", () => {
  const opened = async (data?: LeagueSettingsData) => {
    const app = openSettings(data);
    await screen.findByRole("heading", { level: 1, name: SETTINGS_TITLE });
    return app;
  };

  it("opens on the league's maximum, no area with a minimum, and no club maximum", async () => {
    await opened();

    expect(box(squadMaximumLabel).value).toBe(String(FIRST.squadMaximum));
    for (const area of AREAS) expect(box(areaMinimumLabel(area)).value).toBe("0");
    expect(clubTick().checked).toBe(false);
    expect(screen.queryByRole("textbox", { name: clubMaximumLabel })).toBeNull();
  });

  it("saves each field changed: the maximum, a minimum in an area, and the club maximum turned on and set", async () => {
    const app = await opened();
    await fill(squadMaximumLabel, "20");
    await fill(areaMinimumLabel("defence"), "4");
    await userEvent.click(clubTick());
    await fill(clubMaximumLabel, "3");
    await save();

    expect(savedSettings(app)).toEqual({
      ...FIRST,
      squadMaximum: 20,
      minimumByArea: { goalkeeper: 0, defence: 4, defensiveMidfield: 0, midfield: 0, attackingMidfield: 0, attack: 0 },
      maxPerClub: 3,
    });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(savedWords(CHANGES_FROM)));
  });

  it("saves the minimums and the club maximum off again, as none", async () => {
    const minimumByArea = { goalkeeper: 1, defence: 0, defensiveMidfield: 0, midfield: 0, attackingMidfield: 0, attack: 0 };
    const app = await opened({ view: { part: { ...FIRST, minimumByArea, maxPerClub: 3 }, revision: REVISION, changesFrom: CHANGES_FROM } });
    expect(box(clubMaximumLabel).value).toBe("3");
    await fill(areaMinimumLabel("goalkeeper"), "0");
    await userEvent.click(clubTick());
    await save();

    expect(savedSettings(app)).toEqual(FIRST);
  });

  it("putting a minimum back to 0 leaves nothing to save", async () => {
    await opened();
    await fill(areaMinimumLabel("attack"), "2");
    await fill(areaMinimumLabel("attack"), "0");

    expect(screen.getByText(unchangedWords)).toBeTruthy();
  });

  it.each([
    ["a maximum above 25", squadMaximumLabel, "26", "The squad's maximum, 26, is above 25, a Premier League squad."],
    ["minimums above the maximum", areaMinimumLabel("defence"), "15", `The squad's minimums by area add up to 15, more than its maximum size, ${FIRST.squadMaximum}.`],
  ])("shows the server's refusal of %s", async (_, name, text, refusal) => {
    const app = await opened();
    app.leagueSettings.save.mockResolvedValueOnce(refusal);
    await fill(name, text);
    await save();

    expect((await screen.findByRole("alert")).textContent).toBe(refusal);
  });

  it("shows the server's refusal of a club maximum of 0", async () => {
    const app = await opened();
    const refusal = "The most players from one club must be a whole number, 1 or more, not 0.";
    app.leagueSettings.save.mockResolvedValueOnce(refusal);
    await userEvent.click(clubTick());
    await fill(clubMaximumLabel, "0");
    await save();

    expect(savedSettings(app).maxPerClub).toBe(0);
    expect((await screen.findByRole("alert")).textContent).toBe(refusal);
  });

  it.each([
    ["the maximum", () => fill(squadMaximumLabel, ""), blankSquadMaximumWords],
    ["an area's minimum", () => fill(areaMinimumLabel("midfield"), ""), blankAreaMinimumWords("midfield")],
    ["the club maximum, once turned on,", () => userEvent.click(clubTick()), blankClubMaximumWords],
  ])("with %s left without a number, Save is offered, refuses it itself, and asks the server nothing (#623)", async (_, leaveBlank, words) => {
    const app = await opened();
    await leaveBlank();
    expect(screen.queryByText(unchangedWords)).toBeNull();
    await save();

    expect((await screen.findByRole("alert")).textContent).toBe(words);
    expect(app.leagueSettings.save).not.toHaveBeenCalled();
  });

  it("says a league with no squad size limit has none, with no box for it", async () => {
    await opened({ view: { part: { ...FIRST, squadMaximum: null }, revision: REVISION, changesFrom: CHANGES_FROM } });

    expect(screen.getByText(noSquadSizeWords)).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: squadMaximumLabel })).toBeNull();
  });
});

it("keeps the edits when someone else saves, says so, and loads the latest on asking", async () => {
  const app = openSettings();
  await screen.findByRole("heading", { level: 1, name: SETTINGS_TITLE });
  await setGames("2");
  const theirs: SettingsView = { part: { ...FIRST, oddTeamOut: "bye", gamesPerGameweek: 3 }, revision: "rules-2" as Revision, changesFrom: CHANGES_FROM };
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
