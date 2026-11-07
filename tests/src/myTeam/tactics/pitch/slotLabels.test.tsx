// Each slot's position label on the Tactics pitch (#857; spec/05 What the pitch shows): it names the
// position, never its side, and a sweeper or libero is a centre-back, shown CB (Craig, 4 Nov 2026).

import { describe, expect, it } from "vitest";
import type { Cell } from "../../../../../convex/lineup/pitch";
import type { Position } from "../../../../../convex/positions/positionTables";
import { blockOf, member, openedPitch, SAVED, type Member } from "../../../../support/src/tacticsScreen.harness";

/** One player in a cell of each kind, left and right, with the label his slot shows. */
const SLOTS: { player: Member; cell: Cell; label: string }[] = (
  [
    [["GK"], { area: "goalkeeper", lane: "centre" }, "GK"],
    [["FB"], { area: "defence", lane: "left" }, "FB"],
    [["FB"], { area: "defence", lane: "right" }, "FB"],
    [["CB"], { area: "defence", lane: "centre" }, "CB"],
    [["CB"], { area: "defence", lane: "leftCentre" }, "CB"],
    [["CB"], { area: "defence", lane: "rightCentre" }, "CB"],
    [["WB"], { area: "defensiveMidfield", lane: "right" }, "WB"],
    [["CDM"], { area: "defensiveMidfield", lane: "centre" }, "CDM"],
    [["WM"], { area: "midfield", lane: "left" }, "WM"],
    [["CM"], { area: "midfield", lane: "rightCentre" }, "CM"],
    [["W"], { area: "attackingMidfield", lane: "right" }, "W"],
    [["CAM"], { area: "attackingMidfield", lane: "centre" }, "CAM"],
    [["ST"], { area: "attack", lane: "leftCentre" }, "ST"],
  ] as [Position[], Cell, string][]
).map(([positions, cell, label], index) => ({ player: member(100 + index, `Player ${index}`, positions), cell, label }));

/** The back three's middle man, who plays sweeper or libero when given `role`. */
const MIDDLE_CB = SLOTS[3]!;
const STRIKER = SLOTS[SLOTS.length - 1]!;

/** Every slot filled, the middle centre-back on `role` when one is given. */
const everySlot = (role?: string) => ({
  tactics: {
    ...SAVED,
    squad: SLOTS.map(({ player }) => player),
    lineup: {
      ...SAVED.lineup,
      starters: SLOTS.map(({ player, cell }) => ({ playerCode: player.playerCode, ...cell, ...(player === MIDDLE_CB.player && role !== undefined ? { role } : {}) })),
      bench: [],
    },
  },
});

const blockIn = (slot: (typeof SLOTS)[number]) => blockOf(slot.player, slot.cell);
const labelOf = (slot: (typeof SLOTS)[number]) => blockIn(slot).querySelector("[data-slot-label]")?.textContent;

describe("the pitch's slot labels", () => {
  it("shows every filled slot's position, never its side", async () => {
    await openedPitch(everySlot());
    expect(SLOTS.map(labelOf)).toEqual(SLOTS.map(({ label }) => label));
  });

  it("puts the label before his name on his plate", async () => {
    await openedPitch(everySlot());
    expect(blockIn(STRIKER).textContent).toContain(`ST ${STRIKER.player.name}`);
  });

  it.each(["sweeper", "libero"])("shows a centre-back on %s as CB, under his role", async (role) => {
    await openedPitch(everySlot(role));
    expect(labelOf(MIDDLE_CB)).toBe("CB");
    expect(blockIn(MIDDLE_CB).textContent).toMatch(role === "sweeper" ? /Sweeper/ : /Libero/);
  });
});
