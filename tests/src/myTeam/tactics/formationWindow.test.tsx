// The formation window, against its approved picture (docs/design/approved/team/, "The formation
// window"; #1159): each group's heading and its sample mark, the tiles' parts, the preview's lines
// in the picture's order, and the Save preset… tile on Your presets.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  CLASSICS,
  classicsLine,
  descriptionPlaceholder,
  gainsPlaceholder,
  inUseWords,
  losesPlaceholder,
  sampleNamesWords,
  sampleTextWords,
  savePresetLine,
  savePresetName,
  subtitlePlaceholder,
  WINDOW_TITLE,
  YOUR_PRESETS,
  yourPresetsLine,
} from "../../../../src/myTeam/tactics/formationWindow/words";
import { FIRST_RULES } from "../../../../convex/rules/firstRules";
import { allFormationsWords } from "../../../../src/myTeam/tactics/words";
import { openTactics } from "../../../support/src/tactics.harness";
import { member, openedPitch, SAVED } from "../../../support/src/tacticsScreen.harness";

/** Eleven standing in the 4-4-2, each playing his cell's area. */
const IN_A_442 = (() => {
  const starters = FIRST_RULES.presets.find(({ name }) => name === "4-4-2")!.cells.map((cell, index) => ({ playerCode: index + 1, ...cell }));
  const squad = starters.map(({ playerCode, area }) => member(playerCode, `Player ${playerCode}`, area === "goalkeeper" ? ["GK"] : area === "defence" ? ["CB", "FB"] : area === "attack" ? ["ST"] : ["CM", "WM"]));
  return { tactics: openTactics({ squad, lineup: { ...SAVED.lineup, starters, bench: [] } }) };
})();

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
    await userEvent.click(screen.getByRole("button", { name: YOUR_PRESETS }));
    expect(headingOf(YOUR_PRESETS).textContent).toBe(`${YOUR_PRESETS}${yourPresetsLine}${sampleNamesWords}`);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${CLASSICS}`) }));
    expect(headingOf(CLASSICS).textContent).toBe(`${CLASSICS}${classicsLine}${sampleTextWords}`);
  });

  it("shows the Save preset… tile on Your presets, in place, as saving presets waits", async () => {
    await opened();
    await userEvent.click(screen.getByRole("button", { name: YOUR_PRESETS }));
    expect(screen.getByText(savePresetName)).toBeTruthy();
    expect(screen.getByText(savePresetLine)).toBeTruthy();
    expect(screen.queryByRole("button", { name: savePresetName })).toBeNull();
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
});
