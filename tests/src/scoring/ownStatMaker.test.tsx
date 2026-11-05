// Making an own stat in the rules editor (#262; spec/14, Own stats): it joins the set with the
// scoring, is listed by its name, priced like any category, and one that can't be made says why.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  addCategoryLabel,
  addCategoryWords,
  addPartWords,
  addWords,
  byAreaWords,
  columnWords,
  everyoneWords,
  makeOwnStatWords,
  makeWords,
  ownStatNameLabel,
  ownStatProblemWords,
  ownStatShortCodeLabel,
  partStatLabel,
  partWeightLabel,
  removeCategoryWords,
} from "../../../src/scoring/words";
import { categories, openScoring, retype, save, savedRule, savedSet } from "../../support/src/scoringScreen.harness";

const KEY = "league:tackles_clearances";

/** Opens the maker and types a name and short code, leaving its one stat as it starts. */
async function startMaking(name: string, shortCode: string) {
  await userEvent.click(await screen.findByRole("button", { name: makeOwnStatWords }));
  if (name !== "") await userEvent.type(screen.getByRole("textbox", { name: ownStatNameLabel }), name);
  if (shortCode !== "") await userEvent.type(screen.getByRole("textbox", { name: ownStatShortCodeLabel }), shortCode);
}

/** Tackles + 0.5 × clearances, made. */
async function makeTacklesAndClearances() {
  await startMaking("Tackles + clearances", "T+C");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: partStatLabel(1) }), "Tackles");
  await userEvent.click(screen.getByRole("button", { name: addPartWords }));
  await userEvent.selectOptions(screen.getByRole("combobox", { name: partStatLabel(2) }), "Total clearance");
  await retypeWeight(2, "0.5");
  await userEvent.click(screen.getByRole("button", { name: makeWords }));
}

async function retypeWeight(part: number, text: string) {
  await userEvent.clear(screen.getByRole("textbox", { name: partWeightLabel(part) }));
  await userEvent.type(screen.getByRole("textbox", { name: partWeightLabel(part) }), text);
}

describe("making an own stat", () => {
  it("saves it with the set, listed and opened by its name, priced like any category", async () => {
    const app = openScoring();
    await makeTacklesAndClearances();

    expect(within(await categories()).getByRole("button", { name: /^Tackles \+ clearances/ })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Tackles + clearances" })).toBeTruthy();
    await userEvent.click(screen.getByRole("checkbox", { name: byAreaWords }));
    await save();

    expect(savedSet(app).ownStats).toEqual([
      { stat: KEY, name: "Tackles + clearances", shortCode: "T+C", parts: [{ stat: "tackles", weight: 1 }, { stat: "total_clearance", weight: 0.5 }] },
    ]);
    expect(savedRule(app, KEY)?.values).toHaveProperty("byArea");
  });

  it("takes negative weights: shots less shots on target", async () => {
    const app = openScoring();
    await startMaking("Shots off target", "SOFF");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: partStatLabel(1) }), "Total scoring att");
    await userEvent.click(screen.getByRole("button", { name: addPartWords }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: partStatLabel(2) }), "Ontarget scoring att");
    await retypeWeight(2, "-1");
    await userEvent.click(screen.getByRole("button", { name: makeWords }));
    await retype(columnWords.points, everyoneWords, "-1");
    await save();

    expect(savedSet(app).ownStats?.[0].parts).toEqual([{ stat: "total_scoring_att", weight: 1 }, { stat: "ontarget_scoring_att", weight: -1 }]);
    expect(savedSet(app).rules.at(-1)?.values).toEqual({ all: -1 });
  });

  it.each([
    ["no name", "", "T+C", ownStatProblemWords.name],
    ["no short code", "Tackles + clearances", "", ownStatProblemWords.shortCode],
  ])("refuses one with %s, saying why, and adds nothing", async (_, name, shortCode, reason) => {
    openScoring();
    await startMaking(name, shortCode);
    await userEvent.click(screen.getByRole("button", { name: makeWords }));

    expect((await screen.findByRole("alert")).textContent).toBe(reason);
    expect(within(await categories()).queryByRole("button", { name: /^Tackles \+ clearances/ })).toBeNull();
  });

  it("refuses a weight left without a number", async () => {
    openScoring();
    await startMaking("Tackles + clearances", "T+C");
    await userEvent.clear(screen.getByRole("textbox", { name: partWeightLabel(1) }));
    await userEvent.click(screen.getByRole("button", { name: makeWords }));

    expect(screen.getByText(ownStatProblemWords.weight)).toBeTruthy();
  });

  it("offers its category again once removed", async () => {
    const app = openScoring();
    await makeTacklesAndClearances();
    await userEvent.click(screen.getByRole("button", { name: removeCategoryWords }));
    await userEvent.click(screen.getByRole("button", { name: addCategoryWords }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: addCategoryLabel }), "Tackles + clearances");
    await userEvent.click(screen.getByRole("button", { name: addWords }));
    await save();

    expect(savedSet(app).ownStats).toHaveLength(1);
    expect(savedRule(app, KEY)).toEqual({ shape: "perAction", stat: KEY, values: { all: 0 } });
  });
});
