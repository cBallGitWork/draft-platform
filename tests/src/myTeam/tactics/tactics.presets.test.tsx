// My team's Tactics tab (spec/05): a preset formation put on the lineup, and the role each
// player is given.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FORMATION_KEYS } from "../../../../src/myTeam/tactics/TacticsControls";
import { backGroupPattern, cancelWords } from "../../../../src/myTeam/tactics/formationWindow/words";
import {
  allFormationsWords,
  BENCH_TITLE,
  presetLabel,
  emptySlotLabel,
  roleLabel,
} from "../../../../src/myTeam/tactics/words";
import { rolesOfSlot } from "../../../../convex/lineup/roles";
import { league } from "../../../support/src/shell.harness";
import {
  ARRIZABALAGA,
  HAVERTZ,
  RAYA,
  RICE,
  SALIBA,
  SALIBAS_CELL,
  SAVED,
  SAVED_LINE,
  STARTERS,
  WHITE,
  blockOf,
  openedPitch,
  pickFormation,
  pickRole,
  pitch,
  roleButton,
  rolesOnCard,
  roleShown,
  squadRows,
  swap,
  undo,
} from "../../../support/src/tacticsScreen.harness";

describe("a preset (spec/05; Craig, 26 Oct 2026)", () => {
  const keys = () => within(screen.getByRole("radiogroup", { name: presetLabel })).getAllByRole("radio");

  it("offers the league's presets, and picking one reshapes the pitch keeping the players", async () => {
    await openedPitch();
    // The toolbar's keys are the league's first; every one is in the formation window.
    expect(keys().map((key) => key.parentElement!.textContent)).toEqual(SAVED.presets.slice(0, FORMATION_KEYS).map(({ name }) => name));
    await userEvent.click(screen.getByRole("button", { name: allFormationsWords }));
    const tiles: (string | null)[] = [];
    for (const group of screen.getAllByRole("button", { name: backGroupPattern() })) {
      await userEvent.click(group);
      tiles.push(...within(screen.getByRole("radiogroup", { name: backGroupPattern() })).getAllByRole("radio").map((tile) => tile.getAttribute("aria-label")));
    }
    expect(tiles.toSorted()).toEqual(SAVED.presets.map(({ name }) => name).toSorted());
    await userEvent.click(screen.getByRole("button", { name: cancelWords }));
    await pickFormation("4-4-2");
    // Saliba, at left-centre of defence, keeps that cell, a 4-4-2 back four's; Rice, centre of
    // midfield, takes the nearest of its flat four's; Havertz takes a strike pair's place.
    expect(blockOf(RAYA, { area: "goalkeeper", lane: "centre" })).toBeTruthy();
    expect(blockOf(SALIBA, { area: "defence", lane: "leftCentre" })).toBeTruthy();
    expect(blockOf(RICE, { area: "midfield", lane: "leftCentre" })).toBeTruthy();
    expect(blockOf(HAVERTZ, { area: "attack", lane: "leftCentre" })).toBeTruthy();
  });

  it("can be picked again after moves, to snap back to it", async () => {
    await openedPitch();
    await pickFormation("4-4-2");
    await swap(SALIBA, WHITE);
    await pickFormation("5-4-1");
    expect(blockOf(HAVERTZ, { area: "attack", lane: "centre" })).toBeTruthy();
    await pickFormation("4-4-2");
    expect(blockOf(HAVERTZ, { area: "attack", lane: "leftCentre" })).toBeTruthy();
    // A swap keeps the shape, so each stays where it put him.
    expect(blockOf(SALIBA, { area: "defence", lane: "left" })).toBeTruthy();
  });

  it("marks the shape's empty slots while the lineup can't stand and isn't saved", async () => {
    await openedPitch({ tactics: SAVED, saveAnswer: "A lineup starts 11 players; this one starts 5." });
    await pickFormation("4-4-2");
    const slots = within(pitch()).getAllByRole("img", { name: /^Empty slot/ }).map((slot) => slot.getAttribute("aria-label"));
    // White, off the bench, fills its left back (Craig, 1 Nov 2026; #1025); the rest stay empty.
    expect(slots).toHaveLength(11 - STARTERS.length - 1);
    expect(slots).toContain(emptySlotLabel("defence", "right"));
    expect(blockOf(WHITE, { area: "defence", lane: "left" })).toBeTruthy();
  });

  it("moves a starter the shape has no room for in his area to the nearest area he plays, not the bench (Craig, 1 Nov 2026)", async () => {
    await openedPitch();
    // A 4-2-3-1 has no one in midfield, where Rice stands: he drops into its holding pair.
    await pickFormation("4-2-3-1");
    expect(blockOf(RICE, { area: "defensiveMidfield", lane: "leftCentre" })).toBeTruthy();
    expect(squadRows()[squadRows().indexOf(BENCH_TITLE) + 1]).not.toContain(RICE.name);
  });

  it("saves itself as it stands, and Undo puts the shape away too", async () => {
    const app = await openedPitch();
    await pickFormation("4-4-2");
    expect(app.myTeam.lineupChanges.save).toHaveBeenCalledWith(league.leagueId, expect.objectContaining({ bench: [ARRIZABALAGA.playerCode] }));
    await screen.findByText(SAVED_LINE);
    expect(within(pitch()).queryAllByRole("img", { name: /^Empty slot/ })).toEqual([]);
    await pickFormation("5-4-1");
    await userEvent.click(undo());
    expect(within(pitch()).queryAllByRole("img", { name: /^Empty slot/ })).toEqual([]);
  });
});

describe("roles (spec/05 Roles; #10; Craig, 26 Oct 2026)", () => {
  it("each starter has a picker of his slot's roles, on its first until he is given one; the bench has none", async () => {
    await openedPitch();
    expect(roleShown(SALIBA.name)).toBe("Stopper");
    await userEvent.click(roleButton(SALIBA.name));
    expect(rolesOnCard(SALIBA.name)).toEqual(["Stopper", "Ball-playing centre-back", "No-nonsense centre-back", "Attacking centre-back"]);
    expect(screen.queryByRole("button", { name: roleLabel(WHITE.name) })).toBeNull();
  });

  it("the pitch shows the role's code over his name, its name on hover (#845)", async () => {
    await openedPitch();
    await pickRole(SALIBA.name, "Ball-playing centre-back");
    expect(within(blockOf(SALIBA, SALIBAS_CELL)).getByTitle("Ball-playing centre-back").textContent).toBe("BPD");
    expect(document.activeElement).toBe(roleButton(SALIBA.name));
  });

  it("saves itself with the lineup", async () => {
    const app = await openedPitch();
    await pickRole(SALIBA.name, "Ball-playing centre-back");
    const [, sent] = app.myTeam.lineupChanges.save.mock.lastCall!;
    expect(sent.starters.find((starter) => starter.playerCode === SALIBA.playerCode)).toEqual({ playerCode: SALIBA.playerCode, ...SALIBAS_CELL, role: "ballPlayingDefender" });
  });

  it("a starter moved to another slot starts on its first role", async () => {
    await openedPitch();
    // A 4-4-2 brings White off the bench to its left back, so the two can swap.
    await pickFormation("4-4-2");
    await pickRole(SALIBA.name, "Ball-playing centre-back");
    await swap(SALIBA, WHITE);
    expect(roleShown(SALIBA.name)).toBe(rolesOfSlot({ area: "defence", lane: "left" }, [])[0].name);
  });
});
