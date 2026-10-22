// The rules editor's rules (#30; spec/14, How a rule scores): what sits behind each tick box, the
// three kinds of rule, and adding and removing categories, each seen in the set it saves.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { addBandWords, addCategoryLabel, addCategoryWords, addWords, AREA_WORDS, bandFromWords, bandRowWords, byAreaWords, byPositionWords, columnWords, everyoneWords, limitWords, minutesWords, POSITION_WORDS, removeCategoryWords, shapeWords } from "../../../src/scoring/words";
import { discardWords } from "../../../src/rules/words";
import { box, choose, openScoring, retype, save, savedRule, savedSet } from "../../support/src/scoringScreen.harness";

describe("behind the tick boxes", () => {
  it("prices a rule by area, each area starting from the one value", async () => {
    const app = openScoring();
    await choose("Assists");
    await userEvent.click(screen.getByRole("checkbox", { name: byAreaWords }));
    expect(Object.values(AREA_WORDS).map((area) => box(columnWords.points, area).value)).toEqual(["3", "3", "3", "3", "3", "3"]);
    await retype(columnWords.points, AREA_WORDS.attack, "4");
    await save();

    expect(savedRule(app, "assists")?.values).toEqual({ byArea: { goalkeeper: 3, defence: 3, defensiveMidfield: 3, midfield: 3, attackingMidfield: 3, attack: 4 } });
  });

  it("prices a rule by position, each taking its area's value, and back to one value", async () => {
    const app = openScoring();
    await choose("Goals scored");
    await userEvent.click(screen.getByRole("checkbox", { name: byPositionWords }));
    expect(box(columnWords.points, POSITION_WORDS.CB).value).toBe("6");
    expect(box(columnWords.points, POSITION_WORDS.ST).value).toBe("4");
    expect((screen.getByRole("checkbox", { name: byAreaWords }) as HTMLInputElement).checked).toBe(false);
    await userEvent.click(screen.getByRole("checkbox", { name: byPositionWords }));
    await save();

    // The midfield's 5 is the value most positions share.
    expect(savedRule(app, "goals_scored")?.values).toEqual({ all: 5 });
  });

  it("gives a rule a points limit, an end left empty being no limit", async () => {
    const app = openScoring();
    await choose("Assists");
    await userEvent.click(screen.getByRole("checkbox", { name: limitWords }));
    await retype(columnWords.max, everyoneWords, "6");
    expect(box(columnWords.min, everyoneWords).hasAttribute("aria-invalid")).toBe(false);
    await save();

    expect(savedRule(app, "assists")?.limit).toEqual({ all: { max: 6, min: null } });
  });

  it("makes a rule pay only after a number of minutes", async () => {
    const app = openScoring();
    await choose("Assists");
    await userEvent.click(screen.getByRole("checkbox", { name: minutesWords }));
    await retype(columnWords.minutes, everyoneWords, "45");
    await save();

    expect(savedRule(app, "assists")?.minMinutes).toEqual({ all: 45 });
  });

  it("shows a rule saved with a limit and minutes with both ticked", async () => {
    openScoring();
    await choose("Defensive contribution");

    expect((screen.getByRole("checkbox", { name: limitWords }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: byAreaWords }) as HTMLInputElement).checked).toBe(true);
    expect(box(columnWords.max, AREA_WORDS.defence).value).toBe("2");
  });
});

describe("the kind of rule", () => {
  it("pays per number, keeping the points, for every one to begin with", async () => {
    const app = openScoring();
    await choose("Assists");
    await userEvent.click(screen.getByRole("radio", { name: shapeWords.perCount }));
    await retype(columnWords.every, everyoneWords, "2");
    await save();

    expect(savedRule(app, "assists")).toEqual({ shape: "perCount", stat: "assists", values: { all: { every: 2, points: 3 } } });
  });

  it("pays in bands, one added a step past the highest", async () => {
    const app = openScoring();
    await choose("Minutes");
    await userEvent.click(screen.getByRole("button", { name: addBandWords }));
    expect((box(bandFromWords, bandRowWords(everyoneWords, 3)) as HTMLInputElement).value).toBe("61");
    await retype(columnWords.points, bandRowWords(everyoneWords, 3), "3");
    await save();

    expect(savedRule(app, "minutes")?.values).toEqual({ all: [{ atLeast: 1, points: 1 }, { atLeast: 60, points: 2 }, { atLeast: 61, points: 3 }] });
  });
});

describe("the categories", () => {
  it("adds one from the catalogue, chosen and paying nothing until set", async () => {
    const app = openScoring();
    await userEvent.click(await screen.findByRole("button", { name: addCategoryWords }));
    const picker = screen.getByRole("combobox", { name: addCategoryLabel });
    expect(within(picker).queryByRole("option", { name: "Assists" })).toBeNull();
    await userEvent.selectOptions(picker, "Tackles");
    await userEvent.click(screen.getByRole("button", { name: addWords }));

    expect(screen.getByRole("heading", { level: 2, name: "Tackles" })).toBeTruthy();
    await retype(columnWords.points, everyoneWords, "0.5");
    await save();
    expect(savedSet(app).rules.at(-1)).toEqual({ shape: "perAction", stat: "tackles", values: { all: 0.5 } });
  });

  it("discarding a category added opens the last one left", async () => {
    openScoring();
    await userEvent.click(await screen.findByRole("button", { name: addCategoryWords }));
    await userEvent.click(screen.getByRole("button", { name: addWords }));
    await userEvent.click(screen.getByRole("button", { name: discardWords }));

    expect(screen.getByRole("heading", { level: 2, name: "Own goals" })).toBeTruthy();
  });

  it("removes one", async () => {
    const app = openScoring();
    await choose("Own goals");
    await userEvent.click(screen.getByRole("button", { name: removeCategoryWords }));
    await save();

    expect(savedRule(app, "own_goals")).toBeUndefined();
    expect(savedSet(app).rules).toHaveLength(FIRST_RULES.scoring.rules.length - 1);
  });
});

