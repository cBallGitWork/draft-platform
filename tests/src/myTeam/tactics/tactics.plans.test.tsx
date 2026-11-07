// My team's Tactics tab: saved plans (spec/05, Saved plans; #992), as the formation window's Your
// presets (Craig, 6 Nov 2026): Save preset… keeps the formation and every slot's role by name,
// saving under a name he has asks first, × deletes one, and picking one loads it keeping the
// players; a plan whose formation the league no longer has can't be loaded.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { planRefusals } from "../../../../convex/lineup/lineupWords";
import { rolesOfSlot } from "../../../../convex/lineup/roles";
import { FIRST_RULES } from "../../../../convex/rules/firstRules";
import type { Plan } from "../../../../src/myTeam/tactics/seam";
import { planSlotsOf } from "../../../../src/myTeam/tactics/savedPlans";
import {
  applyWords,
  deletePlanLabel,
  notAllowedWords,
  planNameLabel,
  replaceQuestion,
  replaceWords,
  savePresetName,
  saveWords,
  WINDOW_TITLE,
  YOUR_PRESETS,
} from "../../../../src/myTeam/tactics/formationWindow/words";
import { allFormationsWords, presetLabel, presetsWords, rolesLostWords, savePresetWords } from "../../../../src/myTeam/tactics/words";
import { sameCell } from "../../../../convex/lineup/pitch";
import { league } from "../../../support/src/shell.harness";
import { openTactics } from "../../../support/src/tactics.harness";
import { IN_A_442, openedPitch } from "../../../support/src/tacticsScreen.harness";

const presetCells = (name: string) => FIRST_RULES.presets.find((preset) => preset.name === name)!.cells;
/** A plan on the preset, each slot on the last role it offers there, or `role` where given. */
const planOn = (name: string, preset: string, role?: (cell: (typeof FIRST_RULES.presets)[number]["cells"][number]) => string | undefined): Plan => ({
  name,
  slots: presetCells(preset).map((cell) => ({ ...cell, role: role?.(cell) ?? rolesOfSlot(cell, presetCells(preset)).at(-1)!.key })),
});
const PRESS = planOn("Press", "4-3-3");

const openWindow = async () => {
  await userEvent.click(screen.getByRole("button", { name: allFormationsWords }));
  await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${YOUR_PRESETS}`) }));
  return within(screen.getByRole("region", { name: WINDOW_TITLE }));
};
const saveAs = async (name: string) => {
  await userEvent.type(screen.getByLabelText(planNameLabel), name);
  await userEvent.click(screen.getByRole("button", { name: saveWords }));
};
const startersOf = () => IN_A_442.tactics.lineup.starters;

describe("saving a plan", () => {
  it("Save preset… keeps the formation and every slot's role by name, never players, and lists it", async () => {
    const app = await openedPitch(IN_A_442);
    await userEvent.click(screen.getByRole("button", { name: savePresetWords }));
    await saveAs("Flat four");
    expect(app.myTeam.planChanges.save).toHaveBeenCalledWith(league.leagueId, "Flat four", planSlotsOf({ starters: startersOf(), bench: [] }));
    const window = within(screen.getByRole("region", { name: WINDOW_TITLE }));
    expect(window.getByRole("radio", { name: "Flat four" })).toBeTruthy();
    // The toolbar offers it too, to load.
    expect(within(screen.getByRole("radiogroup", { name: presetsWords })).getByRole("radio", { name: "Flat four" })).toBeTruthy();
  });

  it("under a name he already has, it asks to replace it first", async () => {
    const app = await openedPitch({ ...IN_A_442, plans: [PRESS] });
    await userEvent.click((await openWindow()).getByRole("button", { name: new RegExp(`^${savePresetName}`) }));
    await saveAs("Press");
    expect(screen.getByText(replaceQuestion("Press"))).toBeTruthy();
    expect(app.myTeam.planChanges.save).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: replaceWords }));
    expect(app.myTeam.planChanges.save).toHaveBeenCalledWith(league.leagueId, "Press", expect.any(Array));
  });

  it("a sixth is refused in the server's words", async () => {
    await openedPitch({ ...IN_A_442, plans: [PRESS], planAnswer: planRefusals.full });
    await userEvent.click((await openWindow()).getByRole("button", { name: new RegExp(`^${savePresetName}`) }));
    await saveAs("Sixth");
    expect(screen.getByRole("alert").textContent).toBe(planRefusals.full);
  });

  it("× deletes one", async () => {
    const app = await openedPitch({ ...IN_A_442, plans: [PRESS] });
    const window = await openWindow();
    await userEvent.click(window.getByRole("button", { name: deletePlanLabel("Press") }));
    expect(app.myTeam.planChanges.remove).toHaveBeenCalledWith(league.leagueId, "Press");
    expect(window.queryByRole("radio", { name: "Press" })).toBeNull();
  });
});

describe("loading a plan", () => {
  it("reshapes the pitch keeping the players, each slot on the plan's role; a move after it leaves the plan as saved", async () => {
    const app = await openedPitch({ ...IN_A_442, plans: [PRESS] });
    const window = await openWindow();
    await userEvent.click(window.getByRole("radio", { name: "Press" }));
    await userEvent.click(window.getByRole("button", { name: applyWords }));
    const [, saved] = app.myTeam.lineupChanges.save.mock.calls.at(-1)!;
    // Every player stays, starting in a slot of the 4-3-3 or on the bench, each slot on the plan's role.
    expect([...saved.starters.map(({ playerCode }) => playerCode), ...saved.bench].toSorted((one, other) => one - other)).toEqual(
      startersOf().map(({ playerCode }) => playerCode),
    );
    expect(saved.starters.length).toBeGreaterThan(0);
    for (const starter of saved.starters) expect(starter.role).toBe(PRESS.slots.find((slot) => sameCell(slot, starter))!.role);
    // A move after loading changes only this week's lineup: the plan isn't saved again.
    await userEvent.click(within(screen.getByRole("radiogroup", { name: presetLabel })).getByRole("radio", { name: "4-4-2" }));
    expect(app.myTeam.planChanges.save).not.toHaveBeenCalled();
  });

  it("a slot whose role the league no longer offers takes the best-star role, and the line says so", async () => {
    // A sweeper needs a back three, so a back four no longer offers it.
    const sweeper = planOn("Sweeper", "4-4-2", (cell) => (cell.area === "defence" && cell.lane === "leftCentre" ? "sweeper" : undefined));
    await openedPitch({ ...IN_A_442, plans: [sweeper] });
    await userEvent.click(within(screen.getByRole("radiogroup", { name: presetsWords })).getByRole("radio", { name: "Sweeper" }));
    expect(screen.getByRole("alert").textContent).toBe(rolesLostWords("Sweeper", 1));
  });

  it("a plan whose formation the league no longer has is marked and can't be loaded", async () => {
    const tactics = openTactics({ ...IN_A_442.tactics, presets: FIRST_RULES.presets.filter(({ name }) => name !== "4-3-3") });
    await openedPitch({ tactics, plans: [PRESS] });
    expect(screen.queryByRole("radiogroup", { name: presetsWords })).toBeNull();
    const window = await openWindow();
    const tile = window.getByRole("radio", { name: "Press" });
    expect(within(tile).getAllByText(notAllowedWords).length).toBeGreaterThan(0);
    await userEvent.click(tile);
    expect((window.getByRole("button", { name: applyWords }) as HTMLButtonElement).disabled).toBe(true);
  });
});
