// The rules editor's controls in the Wells look (plate.md, Controls; src/frame/Controls.tsx): each
// tick box is a real checkbox its whole row toggles, by pointer or keyboard; the Pays keys are a
// radio group the arrow keys move; and Save says when there is nothing to save.

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { byAreaWords, columnWords, discardWords, everyoneWords, paysLabel, saveWords, shapeWords, wholePointsWords } from "../../../src/scoring/words";
import { box, categories, choose, openScoring, save, savedRule, savedSet } from "../../support/src/scoringScreen.harness";

const tickBox = (name: string) => screen.getByRole("checkbox", { name }) as HTMLInputElement;
const payKey = (name: string) => screen.getByRole("radio", { name }) as HTMLInputElement;
const saveButton = () => screen.getByRole("button", { name: saveWords }) as HTMLButtonElement;

describe("a tick box", () => {
  it("toggles from a click on its row, and back from a click on its words", async () => {
    openScoring();
    await choose("Assists");
    await userEvent.click(tickBox(byAreaWords).closest("label")!);
    expect(tickBox(byAreaWords).checked).toBe(true);

    await userEvent.click(screen.getByText(byAreaWords));
    expect(tickBox(byAreaWords).checked).toBe(false);
  });

  it("toggles from the keyboard: Space on the focused box", async () => {
    const app = openScoring();
    await categories();
    tickBox(wholePointsWords).focus();
    await userEvent.keyboard(" ");
    expect(tickBox(wholePointsWords).checked).toBe(true);
    await save();

    expect(savedSet(app).wholePointsOnly).toBe(true);
  });

  it("stays a real checkbox, its drawn tick hidden from screen readers", async () => {
    openScoring();
    await categories();
    const row = tickBox(wholePointsWords).closest("label");

    expect(row?.textContent).toBe(wholePointsWords);
    expect(row?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("the Pays keys", () => {
  it("are one radio group named Pays, the rule's own kind chosen", async () => {
    openScoring();
    await choose("Assists");

    expect(screen.getByRole("radiogroup", { name: paysLabel })).toBeTruthy();
    expect(payKey(shapeWords.perAction).checked).toBe(true);
    expect(payKey(shapeWords.perCount).checked).toBe(false);
    expect(payKey(shapeWords.bands).checked).toBe(false);
  });

  it("move the choice with the arrow keys", async () => {
    const app = openScoring();
    await choose("Assists");
    payKey(shapeWords.perAction).focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(payKey(shapeWords.perCount).checked).toBe(true);
    expect(box(columnWords.every, everyoneWords).value).toBe("1");
    await save();
    expect(savedRule(app, "assists")?.shape).toBe("perCount");
  });
});

describe("Discard and Save", () => {
  it("with nothing to save: no Discard, and Save disabled in the plain border", async () => {
    openScoring();
    await categories();

    expect(screen.queryByRole("button", { name: discardWords })).toBeNull();
    expect(saveButton().disabled).toBe(true);
    expect(saveButton().className).toBe("action-idle");
  });

  it("with a change: Discard beside Save, which is the action and enabled", async () => {
    openScoring();
    await userEvent.click(await screen.findByText(wholePointsWords));

    expect(screen.getByRole("button", { name: discardWords }).className).toBe("secondary-action");
    expect(saveButton().disabled).toBe(false);
    expect(saveButton().className).toBe("action");
  });

  it("Save is disabled while the save is on its way", async () => {
    const app = openScoring();
    app.scoring.save.mockReturnValueOnce(new Promise(() => {}));
    await userEvent.click(await screen.findByText(wholePointsWords));
    await save();

    expect(saveButton().disabled).toBe(true);
    expect(saveButton().className).toBe("action");
  });
});
