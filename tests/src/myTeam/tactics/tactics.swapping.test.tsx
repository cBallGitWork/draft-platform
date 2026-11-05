// My team's Tactics tab, presets only (spec/05, The pitch; #1022): a refused drop says why in the
// line under the toolbar (Craig, 4 Nov 2026), and a back five's centre-backs swap with each other,
// into and out of the sweeper's cell, by a tap and by a drag (Craig, 1 Nov 2026).

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Cell } from "../../../../convex/lineup/pitch";
import { BENCH_TITLE, refusalWords, roleLabel, swapLabel } from "../../../../src/myTeam/tactics/words";
import { openTactics } from "../../../support/src/tactics.harness";
import {
  ARRIZABALAGA,
  HAVERTZ,
  RICE,
  SALIBA,
  SAVED,
  SQUAD,
  STARTERS,
  WHITE,
  allSwaps,
  at,
  benchOrder,
  blockOf,
  cellOn,
  drag,
  member,
  openedPitch,
  pickUp,
  pitch,
  rowOf,
  swap,
  type Member,
} from "../../../support/src/tacticsScreen.harness";

const KEEPERS_CELL = { area: "goalkeeper", lane: "centre" } as const;
const HAVERTZS_CELL = { area: "attack", lane: "centre" } as const;
const nameOf = (playerCode: number) => SQUAD.find((each) => each.playerCode === playerCode)!.name;
/** The line under the toolbar a refused drop is said in. */
const said = () => screen.getByRole("alert").textContent;

describe("a refused drop says why, in the line under the toolbar (spec/05; Craig, 4 Nov 2026)", () => {
  it("onto an empty cell: nobody moves into one, so the lineup stands and nothing saves", async () => {
    const app = await openedPitch();
    drag(rowOf(WHITE), cellOn({ area: "defence", lane: "left" }));
    expect(said()).toBe(refusalWords({ kind: "emptyCell" }, nameOf));
    expect(benchOrder()).toEqual([ARRIZABALAGA.name, WHITE.name]);
    expect(app.myTeam.lineupChanges.save).not.toHaveBeenCalled();
  });

  it("a starter onto the bench: he leaves the pitch only by a swap, and there is no button to bench him", async () => {
    const app = await openedPitch();
    await pickUp(RICE);
    expect(screen.queryByRole("button", { name: /on the bench$/ })).toBeNull();
    drag(blockOf(HAVERTZ, HAVERTZS_CELL), screen.getByText(BENCH_TITLE));
    expect(said()).toBe(refusalWords({ kind: "offThePitch" }, nameOf));
    expect(blockOf(HAVERTZ, HAVERTZS_CELL)).toBeTruthy();
    expect(app.myTeam.lineupChanges.save).not.toHaveBeenCalled();
  });

  it("a starter onto a bench player who doesn't play his cell, naming him and the cell", async () => {
    await openedPitch();
    drag(blockOf(HAVERTZ, HAVERTZS_CELL), rowOf(WHITE));
    expect(said()).toBe(`${WHITE.name} doesn't play attack, centre.`);
    expect(benchOrder()).toEqual([ARRIZABALAGA.name, WHITE.name]);
  });

  it("an outfield player onto the keeper", async () => {
    await openedPitch();
    drag(rowOf(WHITE), cellOn(KEEPERS_CELL));
    expect(said()).toBe(refusalWords({ kind: "goal" }, nameOf));
  });

  it("goes once a move is made", async () => {
    await openedPitch();
    drag(rowOf(WHITE), cellOn(KEEPERS_CELL));
    await swap(WHITE, SALIBA);
    expect(screen.queryByText(refusalWords({ kind: "goal" }, nameOf))).toBeNull();
  });
});

describe("a back five's centre-backs (Craig, 1 Nov 2026: \"make sure we allow the cbs to be swapped in a 5\")", () => {
  const GABRIEL = member(11, "Gabriel", ["CB"]);
  const KIWIOR = member(12, "Kiwior", ["CB"]);
  const TIMBER = member(13, "Timber", ["FB"]);
  const CALAFIORI = member(14, "Calafiori", ["FB"]);
  const MOSQUERA = member(15, "Mosquera", ["CB"]);
  const back = (lane: Cell["lane"]): Cell => ({ area: "defence", lane });
  // Saliba left of centre, Gabriel in the middle (the sweeper's cell), Kiwior right of centre.
  const FIVE = openTactics({
    ...SAVED,
    squad: [...SQUAD, GABRIEL, KIWIOR, TIMBER, CALAFIORI, MOSQUERA],
    lineup: {
      ...SAVED.lineup,
      starters: [STARTERS[0], at(CALAFIORI, back("left")), at(SALIBA, back("leftCentre")), at(GABRIEL, back("centre")), at(KIWIOR, back("rightCentre")), at(TIMBER, back("right")), ...STARTERS.slice(2)],
      bench: [ARRIZABALAGA.playerCode, WHITE.playerCode, MOSQUERA.playerCode],
    },
  });
  const CENTRE_BACKS: [Member, Cell][] = [[SALIBA, back("leftCentre")], [GABRIEL, back("centre")], [KIWIOR, back("rightCentre")]];
  /** Each centre-back with each other, both ways: six swaps, four into or out of the middle. */
  const PAIRS = CENTRE_BACKS.flatMap(([one, from]) =>
    CENTRE_BACKS.filter(([other]) => other !== one).map(([other, to]) => ({ one: one.name, other: other.name, players: [one, other] as const, from, to })),
  );

  it.each(PAIRS)("$one swaps with $other by a tap, each into the other's cell", async ({ players: [one, other], from, to }) => {
    await openedPitch({ tactics: FIVE });
    await pickUp(one);
    await userEvent.click(within(pitch()).getByRole("button", { name: swapLabel(one.name, other.name) }));
    expect(blockOf(one, to)).toBeTruthy();
    expect(blockOf(other, from)).toBeTruthy();
  });

  it.each(PAIRS)("$one swaps with $other by a drag, each into the other's cell", async ({ players: [one, other], from, to }) => {
    await openedPitch({ tactics: FIVE });
    drag(blockOf(one, from), cellOn(to));
    expect(blockOf(one, to)).toBeTruthy();
    expect(blockOf(other, from)).toBeTruthy();
  });

  it("a centre-back on the bench swaps into the middle by a tap, and back out by a drag", async () => {
    await openedPitch({ tactics: FIVE });
    await pickUp(MOSQUERA);
    expect(allSwaps()).toEqual(expect.arrayContaining([SALIBA, GABRIEL, KIWIOR].map((each) => swapLabel(MOSQUERA.name, each.name))));
    await userEvent.click(within(pitch()).getByRole("button", { name: swapLabel(MOSQUERA.name, GABRIEL.name) }));
    expect(blockOf(MOSQUERA, back("centre"))).toBeTruthy();
    drag(rowOf(GABRIEL), cellOn(back("centre")));
    expect(blockOf(GABRIEL, back("centre"))).toBeTruthy();
  });

  it("the one moved into the middle can take a sweeper role, a centre-back role in a back three or more", async () => {
    await openedPitch({ tactics: FIVE });
    await swap(SALIBA, GABRIEL);
    const picker = screen.getByRole<HTMLSelectElement>("combobox", { name: roleLabel(SALIBA.name) });
    expect(Array.from(picker.options).map((option) => option.value)).toEqual(expect.arrayContaining(["sweeper", "libero"]));
    await userEvent.selectOptions(picker, "sweeper");
    expect(picker.value).toBe("sweeper");
  });
});
