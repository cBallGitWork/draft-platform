// A player's positions at stake, marked on My team's Tactics and Squad tabs (#23; spec/06, When
// positions change), as Craig answered on #23 (6 Nov 2026): a square orange chip after his name
// reading the position, named "Flagged at FB: 3 starts in a row elsewhere" or "Out of position: no
// longer plays FB"; both tabs show both, out of position read from the lineup the next save is
// for; and the Tactics lineup check lists each starter out of position, his name selecting him.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { openPanelLabel } from "../../../../src/myTeam/squad/words";
import { positionMarksOf } from "../../../../src/myTeam/tactics/positionMarks";
import { flaggedMarkLabel, LINEUP_CHECK_TITLE, outOfPositionMarkLabel } from "../../../../src/myTeam/tactics/words";
import { openSquad, PALMER, SAKA, squadOf, tacticsWith } from "../../../support/src/squadTab.harness";
import { openTactics } from "../../../support/src/tactics.harness";
import { RICE, rowOf, SALIBA, SAVED, SQUAD, openTacticsTab, type Member, WHITE } from "../../../support/src/tacticsScreen.harness";

const LEFT_CENTRE_BACK = { area: "defence", lane: "leftCentre" } as const;

/** Saliba, still standing at centre back, flagged there or no longer playing it. */
const flaggedSaliba: Member = { ...SALIBA, positions: ["CB", "CDM"], flagged: [{ position: "CB", startsElsewhere: 3 }] };
const lostSaliba: Member = { ...SALIBA, positions: ["CDM"] };
const tacticsWithSaliba = (saliba: Member) => openTactics({ ...SAVED, squad: SQUAD.map((each) => (each === SALIBA ? saliba : each)) });

const markIn = (row: HTMLElement, label: string) => within(row).getByTitle(label);

describe("his marks", () => {
  it("are out of position where the slot he stands in is one his positions no longer play, then each flag", () => {
    expect(positionMarksOf({ ...lostSaliba, flagged: [{ position: "CDM", startsElsewhere: 4 }] }, LEFT_CENTRE_BACK)).toEqual([
      { kind: "outOfPosition", position: "CB" },
      { kind: "flagged", position: "CDM", startsElsewhere: 4 },
    ]);
  });

  it("are none for a starter who plays his slot, or a bench player, unflagged", () => {
    expect(positionMarksOf(SALIBA, LEFT_CENTRE_BACK)).toEqual([]);
    expect(positionMarksOf(lostSaliba, null)).toEqual([]);
  });

  it("are none for one the football sync doesn't hold, who has no positions to judge", () => {
    expect(positionMarksOf({ ...lostSaliba, unheld: true }, LEFT_CENTRE_BACK)).toEqual([]);
  });
});

describe("on the Tactics tab", () => {
  it("a flagged player's row carries a chip reading the position, named for hover and screen readers", async () => {
    openTacticsTab({ tactics: tacticsWithSaliba(flaggedSaliba) });
    await screen.findByRole("table", { name: /squad/i });
    const chip = markIn(rowOf(flaggedSaliba), flaggedMarkLabel("CB", 3));
    expect(chip.className).toContain("bg-event");
    expect(within(chip).getByText("CB").getAttribute("aria-hidden")).toBe("true");
    expect(within(chip).getByText(flaggedMarkLabel("CB", 3))).toBeTruthy();
    expect(within(rowOf(RICE)).queryByTitle(/Flagged|Out of position/)).toBeNull();
  });

  it("a starter who lost his slot's position stays in it, marked out of position", async () => {
    openTacticsTab({ tactics: tacticsWithSaliba(lostSaliba) });
    await screen.findByRole("table", { name: /squad/i });
    expect(markIn(rowOf(lostSaliba), outOfPositionMarkLabel("CB"))).toBeTruthy();
  });

  it("the lineup check lists each starter out of position, and his name selects him", async () => {
    openTacticsTab({ tactics: tacticsWithSaliba(lostSaliba) });
    const check = (await screen.findByRole("heading", { name: LINEUP_CHECK_TITLE })).closest("section")!;
    expect(within(check).getByRole("listitem").textContent).toBe("Saliba: out of position at CB");
    await userEvent.click(within(check).getByRole("button", { name: lostSaliba.name }));
    expect(within(rowOf(lostSaliba)).getByRole("button", { name: lostSaliba.name }).getAttribute("aria-pressed")).toBe("true");
  });

  it("the lineup check lists nobody while every starter plays his slot", async () => {
    openTacticsTab({ tactics: tacticsWithSaliba(flaggedSaliba) });
    const check = (await screen.findByRole("heading", { name: LINEUP_CHECK_TITLE })).closest("section")!;
    expect(within(check).queryByRole("list")).toBeNull();
    // A bench player who no longer plays a position is never out of position.
    expect(within(rowOf(WHITE)).queryByTitle(/Out of position/)).toBeNull();
  });
});

describe("on the Squad tab", () => {
  it("shows both marks, out of position read from the lineup the next save is for", async () => {
    const players = [SAKA, PALMER];
    const tactics = tacticsWith(players, [[SAKA, { area: "attackingMidfield", lane: "right" }]]);
    // Saka no longer plays the wing he stands on; Palmer, on the bench, is flagged at CAM.
    const squad = tactics.squad.map((member) =>
      member.playerCode === SAKA.code ? { ...member, positions: ["ST" as const] } : { ...member, flagged: [{ position: "CAM" as const, startsElsewhere: 3 }] },
    );
    openSquad({ squad: squadOf(players), tactics: { ...tactics, squad } });
    const rowOfName = async (name: string) => (await screen.findByRole("button", { name: openPanelLabel(name) })).closest("tr")!;
    expect(markIn(await rowOfName("Saka"), outOfPositionMarkLabel("W"))).toBeTruthy();
    expect(markIn(await rowOfName("Palmer"), flaggedMarkLabel("CAM", 3))).toBeTruthy();
  });
});
