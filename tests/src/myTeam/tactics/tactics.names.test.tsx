// Each player's block on the Tactics pitch, named first by the words it shows (spec/12 S12.14: the
// whole of WCAG 2.1 AA; 2.5.3, label in name), at rest and lit for a swap (#2401).

import { within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { shownNotInName } from "../../../support/src/labelInName";
import { openedPitch, openTacticsTab, pickUp, pitch, WHITE } from "../../../support/src/tacticsScreen.harness";

/** Every player's block on the pitch. */
const blocks = () => within(pitch()).getAllByRole("button", { pressed: false });

describe("the pitch's players, for a voice saying what it sees (S12.14, WCAG 2.5.3)", () => {
  it("S12.14 each block is named first by the words it shows, in its order", async () => {
    await openedPitch();
    expect(blocks().length).toBeGreaterThan(0);
    expect(blocks().map(shownNotInName)).toEqual(blocks().map(() => null));
  });

  it("S12.14 a block lit for a swap is named first by the words it shows, the picked-up player's name among them", async () => {
    openTacticsTab();
    await pickUp(WHITE);
    const lit = within(pitch()).getAllByRole("button", { name: /, Swap / });
    expect(lit.length).toBeGreaterThan(0);
    expect(lit.map(shownNotInName)).toEqual(lit.map(() => null));
  });
});
