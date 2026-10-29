// My team's Tactics tab (spec/05): a preset formation put on the lineup, and the role each
// player is given.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  BENCH_TITLE,
  discardWords,
  emptySlotLabel,
  roleLabel,
  presetLabel,
  putHereLabel,
  savedWords,
} from "../../../../src/myTeam/tactics/tacticsWords";
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
  pitch,
  save,
  squadRows,
  type Member,
} from "../../../support/src/tacticsScreen.harness";

describe("a preset (spec/05; Craig, 26 Oct 2026)", () => {
  const picker = () => screen.getByRole<HTMLSelectElement>("combobox", { name: presetLabel });

  it("offers the league's presets, and picking one reshapes the pitch keeping the players", async () => {
    await openedPitch();
    expect(Array.from(picker().options).slice(1).map((option) => option.value)).toEqual(SAVED.presets.map(({ name }) => name));
    await userEvent.selectOptions(picker(), "4-4-2");
    // Saliba, at left-centre of defence, keeps that cell, a 4-4-2 back four's; Rice, centre of
    // midfield, takes the nearest of its flat four's; Havertz takes a strike pair's place.
    expect(blockOf(RAYA, { area: "goalkeeper", lane: "centre" })).toBeTruthy();
    expect(blockOf(SALIBA, { area: "defence", lane: "leftCentre" })).toBeTruthy();
    expect(blockOf(RICE, { area: "midfield", lane: "leftCentre" })).toBeTruthy();
    expect(blockOf(HAVERTZ, { area: "attack", lane: "leftCentre" })).toBeTruthy();
  });

  it("can be picked again after moves, to snap back to it", async () => {
    await openedPitch();
    await userEvent.selectOptions(picker(), "4-4-2");
    expect(picker().value).toBe("");
    await userEvent.click(blockOf(SALIBA, { area: "defence", lane: "leftCentre" }));
    await userEvent.click(screen.getByRole("button", { name: putHereLabel(SALIBA.name, "defence", "centre") }));
    await userEvent.selectOptions(picker(), "4-4-2");
    expect(blockOf(SALIBA, { area: "defence", lane: "leftCentre" })).toBeTruthy();
  });

  it("marks the shape's empty slots, to show where to drag", async () => {
    await openedPitch();
    await userEvent.selectOptions(picker(), "4-4-2");
    const slots = within(pitch()).getAllByRole("img", { name: /^Empty slot/ }).map((slot) => slot.getAttribute("aria-label"));
    expect(slots).toHaveLength(11 - STARTERS.length);
    expect(slots).toContain(emptySlotLabel("defence", "left"));
  });

  it("sends a starter the shape has no room for to the front of the bench", async () => {
    await openedPitch();
    // A 4-2-3-1 has no one in midfield, where Rice stands.
    await userEvent.selectOptions(picker(), "4-2-3-1");
    expect(within(pitch()).queryByRole("button", { name: new RegExp(`^${RICE.name},`) })).toBeNull();
    expect(squadRows()[squadRows().indexOf(BENCH_TITLE) + 1]).toBe("CDM, CMRice ARSMove Up Down");
  });

  it("is saved as it stands, and Discard puts the shape away too", async () => {
    const app = await openedPitch();
    await userEvent.selectOptions(picker(), "4-4-2");
    await userEvent.click(save());
    expect(app.myTeam.lineupChanges.save).toHaveBeenCalledWith(league.leagueId, expect.objectContaining({ bench: [ARRIZABALAGA.playerCode, WHITE.playerCode] }));
    await screen.findByText(savedWords(TACTICS_GAMEWEEK));
    expect(within(pitch()).queryAllByRole("img", { name: /^Empty slot/ })).toEqual([]);
    await userEvent.selectOptions(picker(), "5-4-1");
    await userEvent.click(screen.getByRole("button", { name: discardWords }));
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

  it("is saved with the lineup", async () => {
    const app = await openedPitch();
    await userEvent.selectOptions(picker(SALIBA), "ballPlayingDefender");
    await userEvent.click(save());
    const [, sent] = app.myTeam.lineupChanges.save.mock.lastCall!;
    expect(sent.starters.find((starter) => starter.playerCode === SALIBA.playerCode)).toEqual({ playerCode: SALIBA.playerCode, ...SALIBAS_CELL, role: "ballPlayingDefender" });
  });

  it("a starter moved to another slot starts on its first role", async () => {
    await openedPitch();
    await userEvent.selectOptions(picker(SALIBA), "ballPlayingDefender");
    await userEvent.click(blockOf(SALIBA, SALIBAS_CELL));
    await userEvent.click(screen.getByRole("button", { name: putHereLabel(SALIBA.name, "defence", "centre") }));
    expect(picker(SALIBA).value).toBe("stopper");
  });
});
