// My team's Tactics tab (spec/05, The pitch; #991): a classic formation picked from the formation
// window sets its shape, every slot's role and its instructions, and one change makes it custom
// (Craig, 6 Nov 2026: "Keegan's Newcastle (custom)") until another formation is picked.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DEFAULT_CLASSIC_FORMATIONS } from "../../../../convex/lineup/classics";
import { sameCell } from "../../../../convex/lineup/pitch";
import { applyWords, CLASSIC_FORMATIONS, classicFormationTitleWords, inUseWords, WINDOW_TITLE } from "../../../../src/myTeam/tactics/formationWindow/words";
import { allFormationsWords, customWords, instructionLabel, pitchTitle } from "../../../../src/myTeam/tactics/words";
import { league } from "../../../support/src/shell.harness";
import { IN_A_442, openedPitch, pickFormation, pickRole, roleShown } from "../../../support/src/tacticsScreen.harness";
import { KEEGANS } from "../../../support/convex/lineup.harness";


const openClassicFormations = async () => {
  await userEvent.click(screen.getByRole("button", { name: allFormationsWords }));
  await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${CLASSIC_FORMATIONS}`) }));
  return within(screen.getByRole("region", { name: WINDOW_TITLE }));
};
const pickClassicFormation = async (name: string) => {
  const window = await openClassicFormations();
  await userEvent.click(window.getByRole("radio", { name }));
  await userEvent.click(window.getByRole("button", { name: applyWords }));
};
const pitchHeading = (name: string | null) => screen.getByRole("heading", { name: pitchTitle(name) });
const instructionPicker = (side: "attacking" | "defensive") => screen.getByRole<HTMLSelectElement>("combobox", { name: instructionLabel(side) });

describe("a classic (spec/05; #991)", () => {
  it("lists the league's eight, each with its formation's tag, its season and what it did", async () => {
    await openedPitch(IN_A_442);
    const window = await openClassicFormations();
    expect(window.getByRole("button", { name: new RegExp(`^${CLASSIC_FORMATIONS}`) }).textContent).toBe(`${CLASSIC_FORMATIONS}${DEFAULT_CLASSIC_FORMATIONS.length}`);
    expect(window.getAllByRole("radio").map((tile) => tile.getAttribute("aria-label"))).toEqual(DEFAULT_CLASSIC_FORMATIONS.map(({ name }) => name));
    const tile = within(window.getByRole("radio", { name: KEEGANS.name }));
    expect(tile.getByText("4-4-2")).toBeTruthy();
    expect(tile.getByText(KEEGANS.subtitle)).toBeTruthy();
    expect(tile.getByText(KEEGANS.description)).toBeTruthy();
    // The first is picked and previewed: its subtitle and formation after its name.
    expect(window.getByRole("heading", { level: 3, name: `${KEEGANS.name}${classicFormationTitleWords(KEEGANS.subtitle, "4-4-2")}` })).toBeTruthy();
  });

  it("sets its shape and every slot's role, saved with its name, and the pitch says so", async () => {
    const app = await openedPitch(IN_A_442);
    await pickClassicFormation(KEEGANS.name);
    const starters = IN_A_442.tactics.lineup.starters.map((starter) => ({ ...starter, role: KEEGANS.cells.find((slot) => sameCell(slot, starter))!.role }));
    expect(app.myTeam.lineupChanges.save).toHaveBeenLastCalledWith(league.leagueId, expect.objectContaining({ classicFormation: KEEGANS.name, starters: expect.arrayContaining(starters) }));
    expect(pitchHeading(KEEGANS.name)).toBeTruthy();
    // No Formation key is pressed: none is the classic formation.
    expect(screen.getByRole("radio", { name: "4-4-2" }).getAttribute("aria-checked")).not.toBe("true");
    const window = await openClassicFormations();
    expect(within(window.getByRole("radio", { name: KEEGANS.name })).getByText(inUseWords)).toBeTruthy();
  });

  it("becomes custom once a role changes, and picking it again resets every role", async () => {
    await openedPitch(IN_A_442);
    await pickClassicFormation(KEEGANS.name);
    await pickRole("Player 1", "Commanding keeper");
    expect(pitchHeading(customWords(KEEGANS.name))).toBeTruthy();
    await pickClassicFormation(KEEGANS.name);
    expect(pitchHeading(KEEGANS.name)).toBeTruthy();
    expect(roleShown("Player 1")).toBe("Shot-stopper");
  });

  it("sets its two team instructions, saved with it, and becomes custom once one changes", async () => {
    const app = await openedPitch(IN_A_442);
    await pickClassicFormation(KEEGANS.name);
    expect(app.myTeam.lineupChanges.save.mock.lastCall![1].instructions).toEqual(KEEGANS.instructions);
    expect(instructionPicker("attacking").value).toBe(KEEGANS.instructions.attacking);
    expect(instructionPicker("defensive").value).toBe(KEEGANS.instructions.defensive);
    await userEvent.selectOptions(instructionPicker("defensive"), "Get stuck in");
    expect(pitchHeading(customWords(KEEGANS.name))).toBeTruthy();
    await pickClassicFormation(KEEGANS.name);
    expect(pitchHeading(KEEGANS.name)).toBeTruthy();
    expect(instructionPicker("defensive").value).toBe(KEEGANS.instructions.defensive);
  });

  it("is left by picking a formation, each starter keeping his role where the new slot offers it", async () => {
    const app = await openedPitch(IN_A_442);
    await pickClassicFormation(KEEGANS.name);
    await pickFormation("4-4-2");
    expect(pitchHeading("4-4-2")).toBeTruthy();
    const sent = app.myTeam.lineupChanges.save.mock.lastCall![1];
    expect(sent.classicFormation).toBeUndefined();
    // Player 3, at left-centre of the back four, stays Keegan's attacking centre-back.
    expect(sent.starters.find(({ playerCode }) => playerCode === 3)?.role).toBe("attackingCentreBack");
  });
});
