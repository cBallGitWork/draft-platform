// The formation window, against its approved picture (docs/design/approved/team/, "The formation
// window"; #1159): each group's heading and its sample mark, the tiles' parts, the preview's lines
// in the picture's order, and the Save preset… tile on Your presets.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  CLASSIC_FORMATIONS,
  classicFormationsLine,
  costsPlaceholder,
  descriptionPlaceholder,
  gainsPlaceholder,
  inUseWords,
  losesPlaceholder,
  sampleTextWords,
  savePresetLine,
  savePresetWords,
  subtitlePlaceholder,
  unlocksPlaceholder,
  WINDOW_TITLE,
  YOUR_PRESETS,
  yourPresetsLine,
} from "../../../../src/myTeam/tactics/formationWindow/words";
import { allFormationsWords } from "../../../../src/myTeam/tactics/words";
import { IN_A_442, openedPitch } from "../../../support/src/tacticsScreen.harness";

/** The window, opened from All formations; with `in442`, over a side standing in the 4-4-2. */
const opened = async (in442 = false) => {
  await openedPitch(in442 ? IN_A_442 : undefined);
  await userEvent.click(screen.getByRole("button", { name: allFormationsWords }));
  return within(screen.getByRole("region", { name: WINDOW_TITLE }));
};

const headingOf = (name: string) => screen.getByRole("heading", { level: 3, name: new RegExp(`^${name}`) });

describe("the formation window", () => {
  it("heads Your presets and the Classics with their line and sample mark, as drawn", async () => {
    await opened();
    await userEvent.click(screen.getByRole("button", { name: `${YOUR_PRESETS}0` }));
    // A manager's own presets are real names now (#992): no sample mark.
    expect(headingOf(YOUR_PRESETS).textContent).toBe(`${YOUR_PRESETS}${yourPresetsLine}`);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${CLASSIC_FORMATIONS}`) }));
    expect(headingOf(CLASSIC_FORMATIONS).textContent).toBe(`${CLASSIC_FORMATIONS}${classicFormationsLine}${sampleTextWords}`);
  });

  it("shows the Save preset… tile on Your presets, in place, its line under its name", async () => {
    await opened();
    await userEvent.click(screen.getByRole("button", { name: `${YOUR_PRESETS}0` }));
    expect(screen.getByRole("button", { name: `${savePresetWords}${savePresetLine}` })).toBeTruthy();
  });

  it("gives each tile its name, its formation's tag, a subtitle and a description waiting on Craig's words, and In use", async () => {
    const window = await opened(true);
    const tile = within(window.getByRole("radio", { name: "4-4-2" }));
    expect(tile.getAllByText("4-4-2")).toHaveLength(2);
    expect(tile.getByRole("img", { name: subtitlePlaceholder("4-4-2") })).toBeTruthy();
    expect(tile.getByRole("img", { name: descriptionPlaceholder("4-4-2") })).toBeTruthy();
    expect(tile.getByText(inUseWords)).toBeTruthy();
    expect(within(window.getByRole("radio", { name: "4-3-3" })).queryByText(inUseWords)).toBeNull();
  });

  it("lists the preview's lines in the picture's order, Gains and Loses as placeholders", async () => {
    const window = await opened();
    expect(window.getAllByRole("term").map((term) => term.textContent)).toEqual(["Applies", "Gains", "Loses", "Unlocks", "Costs"]);
    expect(window.getByRole("img", { name: gainsPlaceholder })).toBeTruthy();
    expect(window.getByRole("img", { name: losesPlaceholder })).toBeTruthy();
  });

  it("shows Unlocks and Costs as placeholders that never say team instructions are still to be built (#1776)", async () => {
    const window = await opened();
    for (const words of [unlocksPlaceholder, costsPlaceholder]) {
      const mark = window.getByRole("img", { name: words });
      expect(mark.getAttribute("title")).toBe(words);
      expect(words).not.toMatch(/built/);
    }
  });
});
