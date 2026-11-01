// My team's Tactics tab (spec/05): a preset formation put on the lineup, and the role each
// player is given.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FORMATION_KEYS } from "../../../../src/myTeam/tactics/TacticsControls";
import { cancelWords } from "../../../../src/myTeam/tactics/formationWindow/words";
import {
  allFormationsWords,
  BENCH_TITLE,
  presetLabel,
  emptySlotLabel,
  roleLabel,
  putHereLabel,
  savedWords,
} from "../../../../src/myTeam/tactics/words";
import { league } from "../../../support/src/shell.harness";
import { TACTICS_GAMEWEEK } from "../../../support/src/tactics.harness";
import {
  ARRIZABALAGA,
  HAVERTZ,
  RAYA,
  RICE,
  SALIBA,
  SAVED,
  STARTERS,
  WHITE,
  blockOf,
  openedPitch,
  pickFormation,
  pickUp,
  pitch,
  squadRows,
  undo,
  type Member,
} from "../../../support/src/tacticsScreen.harness";

describe("a preset (spec/05; Craig, 26 Oct 2026)", () => {
  const keys = () => within(screen.getByRole("radiogroup", { name: presetLabel })).getAllByRole("radio");

  it("offers the league's presets, and picking one reshapes the pitch keeping the players", async () => {
    await openedPitch();
    // The toolbar's keys are the league's first; every one is in the formation window.
    expect(keys().map((key) => key.parentElement!.textContent)).toEqual(SAVED.presets.slice(0, FORMATION_KEYS).map(({ name }) => name));
    await userEvent.click(screen.getByRole("button", { name: allFormationsWords }));
    const tiles: (string | null)[] = [];
    for (const group of screen.getAllByRole("button", { name: /^Back \d/ })) {
      await userEvent.click(group);
      tiles.push(...within(screen.getByRole("radiogroup", { name: /^Back/ })).getAllByRole("radio").map((tile) => tile.getAttribute("aria-label")));
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
    await pickUp(SALIBA);
    await userEvent.click(screen.getByRole("button", { name: putHereLabel(SALIBA.name, "defence", "centre") }));
    await pickFormation("4-4-2");
    expect(blockOf(SALIBA, { area: "defence", lane: "leftCentre" })).toBeTruthy();
  });

  it("marks the shape's empty slots, to show where to drag, while the lineup can't stand and isn't saved", async () => {
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
    await screen.findByText(savedWords(TACTICS_GAMEWEEK));
    expect(within(pitch()).queryAllByRole("img", { name: /^Empty slot/ })).toEqual([]);
    await pickFormation("5-4-1");
    await userEvent.click(undo());
    expect(within(pitch()).queryAllByRole("img", { name: /^Empty slot/ })).toEqual([]);
  });
});

describe("roles (spec/05 Roles; #10; Craig, 26 Oct 2026)", () => {
  const picker = (player: Member) => screen.getByRole<HTMLSelectElement>("combobox", { name: roleLabel(player.name) });
  const SALIBAS_CELL = { area: "defence", lane: "leftCentre" } as const;

  it("each starter has a picker of his slot's roles, on its first until he is given one; the bench has none", async () => {
    await openedPitch();
    expect(Array.from(picker(SALIBA).options).map((option) => option.text)).toEqual(["Stopper", "Ball-playing defender"]);
    expect(picker(SALIBA).value).toBe("stopper");
    expect(screen.queryByRole("combobox", { name: roleLabel(WHITE.name) })).toBeNull();
  });

  it("the pitch shows the role under his name", async () => {
    await openedPitch();
    await userEvent.selectOptions(picker(SALIBA), "ballPlayingDefender");
    expect(within(blockOf(SALIBA, SALIBAS_CELL)).getByText("Ball-playing defender")).toBeTruthy();
    expect(document.activeElement).toBe(picker(SALIBA));
  });

  it("saves itself with the lineup", async () => {
    const app = await openedPitch();
    await userEvent.selectOptions(picker(SALIBA), "ballPlayingDefender");
    const [, sent] = app.myTeam.lineupChanges.save.mock.lastCall!;
    expect(sent.starters.find((starter) => starter.playerCode === SALIBA.playerCode)).toEqual({ playerCode: SALIBA.playerCode, ...SALIBAS_CELL, role: "ballPlayingDefender" });
  });

  it("a starter moved to another slot starts on its first role", async () => {
    await openedPitch();
    await userEvent.selectOptions(picker(SALIBA), "ballPlayingDefender");
    await pickUp(SALIBA);
    await userEvent.click(screen.getByRole("button", { name: putHereLabel(SALIBA.name, "defence", "centre") }));
    expect(picker(SALIBA).value).toBe("stopper");
  });
});
