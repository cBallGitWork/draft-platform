// Player scoring and the rules editor (#30, #354; spec/14, Who owns it, and The rules editor):
// reached from "Your leagues" by anyone in the league, and edited by the admin alone; each category
// in full names with one value, everything else behind a tick box; and the whole set saved from the
// gameweek the server gives, or the reason it wasn't.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { LEAGUES_TITLE } from "../../../src/leagues/words";
import { gameweekWords } from "../../../src/words";
import {
  addCategoryWords,
  blankBoxWords,
  byAreaWords,
  byPositionWords,
  columnWords,
  everyoneWords,
  fractionsReadWords,
  limitWords,
  loadingWords,
  minutesWords,
  readOnlyWords,
  removeCategoryWords,
  savedWords,
  SCORING_TITLE,
  shapeWords,
  wholePointsWords,
} from "../../../src/scoring/words";
import { discardWords, saveWords, unchangedWords } from "../../../src/rules/words";
import { ADMINS_VIEW, CHANGES_FROM } from "../../support/src/scoring.harness";
import { box, categories, choose, openScoring, retype, save, savedSet, SCORING_PAGE } from "../../support/src/scoringScreen.harness";
import { adminSeeing, coCommissioned, commissioner, league, managerIn, newcomer, openApp, withNoPart } from "../../support/src/shell.harness";

const PAGE = SCORING_PAGE;

describe("reaching Player scoring", () => {
  it.each([
    ["the commissioner", commissioner],
    ["the co-commissioner", managerIn(coCommissioned)],
    ["a manager", managerIn(league)],
    ["the admin, with no part in the league", adminSeeing(withNoPart(league))],
  ])("%s opens it from the league's row on Your leagues", async (_, session) => {
    const app = openApp(LEAGUES_PATH, session);
    await userEvent.click(await screen.findByRole("link", { name: SCORING_TITLE }));

    expect(await screen.findByRole("heading", { level: 1, name: SCORING_TITLE })).toBeTruthy();
    expect(app.path()).toBe(PAGE);
    expect(app.scoring.useScoring).toHaveBeenCalled();
  });

  it("someone with no part in the league is sent back to Your leagues", async () => {
    const app = openApp(PAGE, newcomer);
    await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE });
    expect(app.path()).toBe(LEAGUES_PATH);
  });
});

describe("#354 Done: for everyone but the admin, it shows the rules read only", () => {
  const openAsManager = () => openApp(PAGE, managerIn(league), { scoring: { view: { ...structuredClone(ADMINS_VIEW), canEdit: false } } });

  it("lists the categories and opens one, every control disabled, with nothing to add, remove or save", async () => {
    openAsManager();
    await choose("Assists");

    expect(box(columnWords.points, everyoneWords).value).toBe("3");
    // Disabled by the fieldset around them, so :disabled, not their own `disabled`.
    for (const control of [box(columnWords.points, everyoneWords), screen.getByRole("checkbox", { name: byAreaWords }), screen.getByRole("radio", { name: shapeWords.perAction })]) {
      expect(control.matches(":disabled")).toBe(true);
    }
    for (const name of [addCategoryWords, removeCategoryWords, saveWords]) expect(screen.queryByRole("button", { name })).toBeNull();
  });

  it("says whether points can be fractions, and that only the admin changes them", async () => {
    openAsManager();
    await categories();

    expect(screen.getByText(fractionsReadWords)).toBeTruthy();
    expect(screen.getByText(readOnlyWords)).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: wholePointsWords })).toBeNull();
  });
});

describe("what it opens on", () => {
  it("lists each category in full names with its one value, or how it's set, the first chosen", async () => {
    openScoring();
    const rows = within(await categories()).getAllByRole("button");

    expect(rows.map((row) => row.textContent)).toEqual([
      "MinutesBands",
      "Goals scoredBy area",
      "Assists3",
      "Clean sheetsBy area",
      "Goals concededBy area",
      "SavesBy area",
      "Penalties saved5",
      "Penalties missed−2",
      "Defensive contributionBy area",
      "Yellow cards−1",
      "Red cards−3",
      "Own goals−2",
    ]);
    expect(rows[0].getAttribute("aria-current")).toBe("true");
    expect(rows.slice(1).every((row) => !row.hasAttribute("aria-current"))).toBe(true);
  });

  it("opens a category priced the same for all on its one value, everything else behind a tick box", async () => {
    openScoring();
    await choose("Assists");

    expect(screen.getByRole("heading", { level: 2, name: "Assists" })).toBeTruthy();
    expect(box(columnWords.points, everyoneWords).value).toBe("3");
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    for (const tick of [byAreaWords, byPositionWords, limitWords, minutesWords]) {
      expect((screen.getByRole("checkbox", { name: tick }) as HTMLInputElement).checked).toBe(false);
    }
    expect((screen.getByRole("radio", { name: shapeWords.perAction }) as HTMLInputElement).checked).toBe(true);
  });

  it("says from which gameweek a change applies, and that nothing has changed yet", async () => {
    openScoring();
    await categories();

    expect(screen.getByText(gameweekWords(CHANGES_FROM))).toBeTruthy();
    expect(screen.getByText(unchangedWords)).toBeTruthy();
    expect((screen.getByRole("button", { name: saveWords }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("#30 Done: an edit saves, from the next gameweek", () => {
  it("saves the whole set with the one value changed, and says from when", async () => {
    const app = openScoring();
    await choose("Assists");
    await retype(columnWords.points, everyoneWords, "4");
    await save();

    expect(app.scoring.save).toHaveBeenCalledOnce();
    expect(savedSet(app)).toEqual({
      ...FIRST_SCORING,
      rules: FIRST_SCORING.rules.map((rule) => (rule.stat === "assists" ? { ...rule, values: { all: 4 } } : rule)),
    });
    expect((await screen.findByRole("status")).textContent).toBe(savedWords(CHANGES_FROM));
  });

  it.each([
    "The scoring set can't be saved: the Assists rule pays 0.25; points are kept in tenths.",
    'The scoring set can\'t be saved: the own stat own_assists has the name "assists", which the catalogue\'s Assists has.',
  ])("shows why the server refused it: %s", async (refusal) => {
    const app = openScoring();
    app.scoring.save.mockResolvedValueOnce(refusal);
    await choose("Assists");
    await retype(columnWords.points, everyoneWords, "0.25");
    await save();

    expect((await screen.findByRole("alert")).textContent).toBe(refusal);
  });

  it("refuses a box left without a number itself, naming the category, and asks the server nothing", async () => {
    const app = openScoring();
    await choose("Assists");
    await retype(columnWords.points, everyoneWords, "");
    expect(box(columnWords.points, everyoneWords).getAttribute("aria-invalid")).toBe("true");
    await save();

    expect((await screen.findByRole("alert")).textContent).toBe(blankBoxWords("Assists"));
    expect(app.scoring.save).not.toHaveBeenCalled();
  });

  it("takes Infinity typed in a box for no number, refusing it itself", async () => {
    const app = openScoring();
    await choose("Assists");
    await retype(columnWords.points, everyoneWords, "Infinity");
    expect(box(columnWords.points, everyoneWords).getAttribute("aria-invalid")).toBe("true");
    await save();

    expect((await screen.findByRole("alert")).textContent).toBe(blankBoxWords("Assists"));
    expect(app.scoring.save).not.toHaveBeenCalled();
  });

  it("discards the changes made, back to the set as saved", async () => {
    openScoring();
    await choose("Assists");
    await retype(columnWords.points, everyoneWords, "4");
    await userEvent.click(screen.getByRole("button", { name: discardWords }));

    expect(box(columnWords.points, everyoneWords).value).toBe("3");
    expect(screen.getByText(unchangedWords)).toBeTruthy();
  });

  it("switches whole points only on", async () => {
    const app = openScoring();
    await userEvent.click(await screen.findByRole("checkbox", { name: wholePointsWords }));
    await save();

    expect(savedSet(app).wholePointsOnly).toBe(true);
  });
});

it("says the scoring is loading while the server answers, to screen readers too", async () => {
  openScoring({ loading: true });
  await screen.findByRole("heading", { level: 1, name: SCORING_TITLE });
  expect(screen.getByRole("status").textContent).toBe(loadingWords);
});
