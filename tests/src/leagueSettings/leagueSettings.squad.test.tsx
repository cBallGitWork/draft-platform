// League settings' squad (#341): the squad's maximum, a minimum in each area and the most from one
// club, saved from the next gameweek, or the reason they weren't.

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AREAS } from "../../../convex/lineup/pitch";
import {
  areaMinimumLabel,
  areaMinimumsHint,
  blankAreaMinimumWords,
  blankClubMaximumWords,
  blankGamesWords,
  blankSquadMaximumWords,
  clubMaximumHint,
  clubMaximumLabel,
  clubMaximumWords,
  gamesHint,
  gamesLabel,
  noSquadSizeWords,
  savedWords,
  squadMaximumHint,
  squadMaximumLabel,
} from "../../../src/leagueSettings/words";
import { unchangedWords } from "../../../src/rules/words";
import { REVISION } from "../../support/src/leagueSettings.harness";
import { box, fill, FIRST_SETTINGS, openedOn, openedSettings, openTab, save, savedSettings } from "../../support/src/leagueSettingsScreen.harness";
import { CHANGES_FROM } from "../../support/src/scoring.harness";
import { descriptionOf, refusalBeside } from "../../support/src/describedBy";

const clubTick = () => screen.getByRole("checkbox", { name: clubMaximumWords }) as HTMLInputElement;

describe("the squad (#341)", () => {
  it("opens on the league's maximum, no area with a minimum, and no club maximum", async () => {
    await openedOn("squad");

    expect(box(squadMaximumLabel).value).toBe(String(FIRST_SETTINGS.squadMaximum));
    for (const area of AREAS) expect(box(areaMinimumLabel(area)).value).toBe("0");
    expect(clubTick().checked).toBe(false);
    expect(screen.queryByRole("textbox", { name: clubMaximumLabel })).toBeNull();
  });

  it("saves each field changed: the maximum, a minimum in an area, and the club maximum turned on and set", async () => {
    const app = await openedOn("squad");
    await fill(squadMaximumLabel, "20");
    await fill(areaMinimumLabel("defence"), "4");
    await userEvent.click(clubTick());
    await fill(clubMaximumLabel, "3");
    await save();

    expect(savedSettings(app)).toEqual({
      ...FIRST_SETTINGS,
      squadMaximum: 20,
      minimumByArea: { goalkeeper: 0, defence: 4, defensiveMidfield: 0, midfield: 0, attackingMidfield: 0, attack: 0 },
      maxPerClub: 3,
    });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(savedWords(CHANGES_FROM)));
  });

  it("saves the minimums and the club maximum off again, as none", async () => {
    const minimumByArea = { goalkeeper: 1, defence: 0, defensiveMidfield: 0, midfield: 0, attackingMidfield: 0, attack: 0 };
    const app = await openedOn("squad",{ view: { part: { ...FIRST_SETTINGS, minimumByArea, maxPerClub: 3 }, revision: REVISION, changesFrom: CHANGES_FROM } });
    expect(box(clubMaximumLabel).value).toBe("3");
    await fill(areaMinimumLabel("goalkeeper"), "0");
    await userEvent.click(clubTick());
    await save();

    expect(savedSettings(app)).toEqual(FIRST_SETTINGS);
  });

  it("putting a minimum back to 0 leaves nothing to save", async () => {
    await openedOn("squad");
    await fill(areaMinimumLabel("attack"), "2");
    await fill(areaMinimumLabel("attack"), "0");

    expect(screen.getByText(unchangedWords)).toBeTruthy();
  });

  it.each([
    ["a maximum above 25", squadMaximumLabel, "26", "The squad's maximum, 26, is above 25, a Premier League squad."],
    ["minimums above the maximum", areaMinimumLabel("defence"), "15", `The squad's minimums by area add up to 15, more than its maximum size, ${FIRST_SETTINGS.squadMaximum}.`],
  ])("shows the server's refusal of %s", async (_, name, text, refusal) => {
    const app = await openedOn("squad");
    app.leagueSettings.save.mockResolvedValueOnce(refusal);
    await fill(name, text);
    await save();

    expect((await screen.findByRole("alert")).textContent).toBe(refusal);
  });

  it("shows the server's refusal of a club maximum of 0", async () => {
    const app = await openedOn("squad");
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
    const app = await openedOn("squad");
    await leaveBlank();
    expect(screen.queryByText(unchangedWords)).toBeNull();
    await save();

    expect((await screen.findByRole("alert")).textContent).toBe(words);
    expect(app.leagueSettings.save).not.toHaveBeenCalled();
  });

  it("with every box left without a number, each refused save says so beside the box it names, the cursor in it, in the order shown (#645)", async () => {
    await openedSettings();
    await fill(gamesLabel, "");
    await openTab("squad");
    const named: (readonly [label: string, words: string])[] = [
      [squadMaximumLabel, blankSquadMaximumWords],
      ...AREAS.map((area) => [areaMinimumLabel(area), blankAreaMinimumWords(area)] as const),
      [clubMaximumLabel, blankClubMaximumWords],
    ];
    await userEvent.click(clubTick());
    for (const [label] of named) await fill(label, "");
    // The games box, first in the order but on the Fixtures tab, is named in the bar.
    await save();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(blankGamesWords));
    await openTab("fixtures");
    await fill(gamesLabel, "1");
    await openTab("squad");
    for (const [label, words] of named) {
      await save();
      await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(words));
      expect(refusalBeside(box(label))).toBe(words);
      expect(document.activeElement).toBe(box(label));
      await fill(label, "1");
    }
  });

  it("describes each box by its hint for screen readers, after any refusal beside it (#915)", async () => {
    await openedSettings();
    expect(descriptionOf(box(gamesLabel))).toBe(gamesHint);
    await openTab("squad");
    await userEvent.click(clubTick());
    const hinted: (readonly [label: string, hint: string])[] = [
      [squadMaximumLabel, squadMaximumHint],
      ...AREAS.map((area) => [areaMinimumLabel(area), areaMinimumsHint] as const),
      [clubMaximumLabel, clubMaximumHint],
    ];
    for (const [label, hint] of hinted) expect(descriptionOf(box(label))).toBe(hint);

    await save();
    await screen.findByRole("alert");
    expect(descriptionOf(box(clubMaximumLabel))).toBe(`${blankClubMaximumWords} ${clubMaximumHint}`);
  });

  it("a refusal beside the club maximum goes with its box when the limit is turned off (#645)", async () => {
    await openedOn("squad");
    await userEvent.click(clubTick());
    await save();
    await screen.findByRole("alert");
    expect(refusalBeside(box(clubMaximumLabel))).toBe(blankClubMaximumWords);
    await userEvent.click(clubTick());

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a save refused again puts the cursor back in the box (#645)", async () => {
    await openedOn("squad");
    await fill(squadMaximumLabel, "");
    await save();
    await screen.findByRole("alert");
    await save();

    expect(document.activeElement).toBe(box(squadMaximumLabel));
  });

  it("says a league with no squad size limit has none, with no box for it", async () => {
    await openedOn("squad",{ view: { part: { ...FIRST_SETTINGS, squadMaximum: null }, revision: REVISION, changesFrom: CHANGES_FROM } });

    expect(screen.getByText(noSquadSizeWords)).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: squadMaximumLabel })).toBeNull();
  });
});
