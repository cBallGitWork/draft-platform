// My team's Tactics tab (spec/05, The pitch; #991): a classic picked from the formation window
// sets its shape, every slot's role and its instructions, and one change makes it custom (Craig, 6 Nov 2026:
// "Keegan's Newcastle (custom)") until another formation is picked.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DEFAULT_CLASSICS } from "../../../../convex/lineup/classics";
import { sameCell } from "../../../../convex/lineup/pitch";
import { applyWords, CLASSICS, classicTitleWords, inUseWords, WINDOW_TITLE } from "../../../../src/myTeam/tactics/formationWindow/words";
import { allFormationsWords, customWords, instructionLabel, pitchTitle, roleLabel } from "../../../../src/myTeam/tactics/words";
import { league } from "../../../support/src/shell.harness";
import { IN_A_442, openedPitch, pickFormation } from "../../../support/src/tacticsScreen.harness";

const keegans = DEFAULT_CLASSICS.find(({ name }) => name === "Keegan's Newcastle")!;

const openClassics = async () => {
  await userEvent.click(screen.getByRole("button", { name: allFormationsWords }));
  await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${CLASSICS}`) }));
  return within(screen.getByRole("region", { name: WINDOW_TITLE }));
};
const pickClassic = async (name: string) => {
  const window = await openClassics();
  await userEvent.click(window.getByRole("radio", { name }));
  await userEvent.click(window.getByRole("button", { name: applyWords }));
};
const pitchHeading = (name: string | null) => screen.getByRole("heading", { name: pitchTitle(name) });
const instructionPicker = (side: "attacking" | "defensive") => screen.getByRole<HTMLSelectElement>("combobox", { name: instructionLabel(side) });

describe("a classic (spec/05; #991)", () => {
  it("lists the league's eight, each with its formation's tag, its season and what it did", async () => {
    await openedPitch(IN_A_442);
    const window = await openClassics();
    expect(window.getByRole("button", { name: new RegExp(`^${CLASSICS}`) }).textContent).toBe(`${CLASSICS}${DEFAULT_CLASSICS.length}`);
    expect(window.getAllByRole("radio").map((tile) => tile.getAttribute("aria-label"))).toEqual(DEFAULT_CLASSICS.map(({ name }) => name));
    const tile = within(window.getByRole("radio", { name: keegans.name }));
    expect(tile.getByText("4-4-2")).toBeTruthy();
    expect(tile.getByText(keegans.subtitle)).toBeTruthy();
    expect(tile.getByText(keegans.description)).toBeTruthy();
    // The first is picked and previewed: its subtitle and formation after its name.
    expect(window.getByRole("heading", { level: 3, name: `${keegans.name}${classicTitleWords(keegans.subtitle, "4-4-2")}` })).toBeTruthy();
  });

  it("sets its shape and every slot's role, saved with its name, and the pitch says so", async () => {
    const app = await openedPitch(IN_A_442);
    await pickClassic(keegans.name);
    const starters = IN_A_442.tactics.lineup.starters.map((starter) => ({ ...starter, role: keegans.cells.find((slot) => sameCell(slot, starter))!.role }));
    expect(app.myTeam.lineupChanges.save).toHaveBeenLastCalledWith(league.leagueId, expect.objectContaining({ classic: keegans.name, starters: expect.arrayContaining(starters) }));
    expect(pitchHeading(keegans.name)).toBeTruthy();
    // No Formation key is pressed: none is the classic.
    expect(screen.getByRole("radio", { name: "4-4-2" }).getAttribute("aria-checked")).not.toBe("true");
    const window = await openClassics();
    expect(within(window.getByRole("radio", { name: keegans.name })).getByText(inUseWords)).toBeTruthy();
  });

  it("becomes custom once a role changes, and picking it again resets every role", async () => {
    await openedPitch(IN_A_442);
    await pickClassic(keegans.name);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: roleLabel("Player 1") }), "commandingKeeper");
    expect(pitchHeading(customWords(keegans.name))).toBeTruthy();
    await pickClassic(keegans.name);
    expect(pitchHeading(keegans.name)).toBeTruthy();
    expect(screen.getByRole<HTMLSelectElement>("combobox", { name: roleLabel("Player 1") }).value).toBe("shotStopper");
  });

  it("sets its two team instructions, saved with it, and becomes custom once one changes", async () => {
    const app = await openedPitch(IN_A_442);
    await pickClassic(keegans.name);
    expect(app.myTeam.lineupChanges.save.mock.lastCall![1].instructions).toEqual(keegans.instructions);
    expect(instructionPicker("attacking").value).toBe(keegans.instructions.attacking);
    expect(instructionPicker("defensive").value).toBe(keegans.instructions.defensive);
    await userEvent.selectOptions(instructionPicker("defensive"), "Get stuck in");
    expect(pitchHeading(customWords(keegans.name))).toBeTruthy();
    await pickClassic(keegans.name);
    expect(pitchHeading(keegans.name)).toBeTruthy();
    expect(instructionPicker("defensive").value).toBe(keegans.instructions.defensive);
  });

  it("is left by picking a formation, each starter keeping his role where the new slot offers it", async () => {
    const app = await openedPitch(IN_A_442);
    await pickClassic(keegans.name);
    await pickFormation("4-4-2");
    expect(pitchHeading("4-4-2")).toBeTruthy();
    const sent = app.myTeam.lineupChanges.save.mock.lastCall![1];
    expect(sent.classic).toBeUndefined();
    // Player 3, at left-centre of the back four, stays Keegan's attacking centre-back.
    expect(sent.starters.find(({ playerCode }) => playerCode === 3)?.role).toBe("attackingCentreBack");
  });
});
