// My team's Tactics tab (#14; spec/05, The pitch): a player picked up (a click, a tap, Enter) or
// dragged, then put in a free cell he plays or on the bench; and the bench put in order.

import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  BENCH_TITLE,
  downLabel,
  moveLabel,
  movingHintWords,
  pickHintWords,
  putHereLabel,
  roleLabel,
  squadTableLabel,
  startingWords,
  swapLabel,
  toBenchWords,
  upLabel,
} from "../../../../src/myTeam/tactics/words";
import { league } from "../../../support/src/shell.harness";
import {
  ARRIZABALAGA,
  HAVERTZ,
  RAYA,
  RICE,
  SALIBA,
  STARTERS,
  WHITE,
  at,
  blockOf,
  openTacticsTab,
  openedPitch,
  pitch,
  squadRows,
  swaps,
  targets,
  type Member,
} from "../../../support/src/tacticsScreen.harness";

describe("moving a player", () => {
  it("picked up from the bench, is offered only the free cells he plays, and put in one", async () => {
    openTacticsTab();
    await userEvent.click(await screen.findByRole("button", { name: moveLabel(WHITE.name) }));

    expect(screen.getByText(movingHintWords(WHITE.name, WHITE.positions))).toBeTruthy();
    // A wing back plays all of defence but Saliba's cell, and the wide lanes of both midfield rows.
    expect(targets()).toEqual([
      putHereLabel(WHITE.name, "midfield", "left"),
      putHereLabel(WHITE.name, "midfield", "right"),
      putHereLabel(WHITE.name, "defensiveMidfield", "left"),
      putHereLabel(WHITE.name, "defensiveMidfield", "right"),
      putHereLabel(WHITE.name, "defence", "left"),
      putHereLabel(WHITE.name, "defence", "centre"),
      putHereLabel(WHITE.name, "defence", "rightCentre"),
      putHereLabel(WHITE.name, "defence", "right"),
    ]);

    await userEvent.click(screen.getByRole("button", { name: putHereLabel(WHITE.name, "defence", "right") }));
    const placed = blockOf(WHITE, { area: "defence", lane: "right" });
    expect(document.activeElement).toBe(placed);
    expect(targets()).toEqual([]);
    expect(screen.getByText(pickHintWords)).toBeTruthy();
    expect(screen.getByText(startingWords(STARTERS.length + 1))).toBeTruthy();
  });

  it("moves a starter to another free cell in his area, picked up by a tap on him", async () => {
    await openedPitch();
    await userEvent.click(blockOf(SALIBA, { area: "defence", lane: "leftCentre" }));
    expect(blockOf(SALIBA, { area: "defence", lane: "leftCentre" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: putHereLabel(SALIBA.name, "defence", "rightCentre") }));
    expect(blockOf(SALIBA, { area: "defence", lane: "rightCentre" })).toBeTruthy();
  });

  it("lights no free cell that breaks the area limits: a second keeper only swaps with the first", async () => {
    await openedPitch();
    await userEvent.click(screen.getByRole("button", { name: moveLabel(ARRIZABALAGA.name) }));
    // The first rules start one keeper, no more and no fewer.
    expect(targets()).toEqual([]);
    expect(swaps()).toEqual([swapLabel(ARRIZABALAGA.name, RAYA.name)]);

    await userEvent.click(blockOf(SALIBA, { area: "defence", lane: "leftCentre" }));
    expect(targets().some((label) => label?.includes("Goalkeeper"))).toBe(false);
    expect(swaps()).toEqual([]);
  });

  it("swaps a bench player for a starter by a tap on the lit starter: the starter takes his place on the bench", async () => {
    const app = await openedPitch();
    await userEvent.click(screen.getByRole("button", { name: moveLabel(ARRIZABALAGA.name) }));
    await userEvent.click(within(pitch()).getByRole("button", { name: swapLabel(ARRIZABALAGA.name, RAYA.name) }));
    expect(document.activeElement).toBe(blockOf(ARRIZABALAGA, { area: "goalkeeper", lane: "centre" }));
    expect(app.myTeam.lineupChanges.save).toHaveBeenLastCalledWith(league.leagueId, {
      starters: [at(ARRIZABALAGA, { area: "goalkeeper", lane: "centre" }), ...STARTERS.slice(1)],
      bench: [RAYA.playerCode, WHITE.playerCode],
    });
  });

  it("swaps two starters, each into the other's cell on its first role, by a drop of one on the other", async () => {
    await openedPitch();
    await userEvent.click(screen.getByRole("button", { name: moveLabel(WHITE.name) }));
    await userEvent.click(screen.getByRole("button", { name: putHereLabel(WHITE.name, "defence", "left") }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: roleLabel(SALIBA.name) }), "ballPlayingDefender");
    const dataTransfer = { setData: () => undefined, effectAllowed: "" };
    fireEvent.dragStart(blockOf(SALIBA, { area: "defence", lane: "leftCentre" }), { dataTransfer });
    const whitesCell = within(pitch()).getByRole("button", { name: swapLabel(SALIBA.name, WHITE.name) }).parentElement!;
    fireEvent.dragOver(whitesCell, { dataTransfer });
    fireEvent.drop(whitesCell, { dataTransfer });
    expect(blockOf(SALIBA, { area: "defence", lane: "left" })).toBeTruthy();
    expect(blockOf(WHITE, { area: "defence", lane: "leftCentre" })).toBeTruthy();
    expect((screen.getByRole("combobox", { name: roleLabel(SALIBA.name) }) as HTMLSelectElement).value).not.toBe("ballPlayingDefender");
  });

  it("swaps a starter with a lit bench player from the squad", async () => {
    await openedPitch();
    await userEvent.click(blockOf(RAYA, { area: "goalkeeper", lane: "centre" }));
    // Only the other keeper plays goal: White isn't lit.
    expect(screen.queryByRole("button", { name: swapLabel(RAYA.name, WHITE.name) })).toBeNull();
    const table = screen.getByRole("table", { name: squadTableLabel });
    await userEvent.click(within(table).getByRole("button", { name: swapLabel(RAYA.name, ARRIZABALAGA.name) }));
    expect(blockOf(ARRIZABALAGA, { area: "goalkeeper", lane: "centre" })).toBeTruthy();
  });

  it("works from the keyboard: Enter picks a player up, Escape puts him back", async () => {
    await openedPitch();
    blockOf(SALIBA, { area: "defence", lane: "leftCentre" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(targets().length).toBeGreaterThan(0);
    await userEvent.keyboard("{Escape}");
    expect(targets()).toEqual([]);
    expect(screen.getByText(pickHintWords)).toBeTruthy();
  });

  it("puts a picked-up starter on the bench, at its end", async () => {
    await openedPitch();
    await userEvent.click(blockOf(RICE, { area: "midfield", lane: "centre" }));
    await userEvent.click(screen.getByRole("button", { name: toBenchWords(RICE.name) }));
    expect(squadRows().at(-1)).toBe("CDM, CMRice ARSMove Up Down");
    expect(within(pitch()).queryByRole("button", { name: new RegExp(`^${RICE.name},`) })).toBeNull();
  });

  it("drags from the bench onto a free cell he plays", async () => {
    openTacticsTab();
    const row = (await screen.findByRole("button", { name: moveLabel(WHITE.name) })).closest("tr")!;
    const dataTransfer = { setData: () => undefined, effectAllowed: "" };
    fireEvent.dragStart(row, { dataTransfer });
    const cell = screen.getByRole("button", { name: putHereLabel(WHITE.name, "defence", "left") }).parentElement!;
    fireEvent.dragOver(cell, { dataTransfer });
    fireEvent.drop(cell, { dataTransfer });
    expect(blockOf(WHITE, { area: "defence", lane: "left" })).toBeTruthy();
  });

  it("dragging a player already picked up keeps him picked up", async () => {
    await openedPitch();
    const move = screen.getByRole("button", { name: moveLabel(WHITE.name) });
    await userEvent.click(move);
    fireEvent.dragStart(move.closest("tr")!, { dataTransfer: { setData: () => undefined, effectAllowed: "" } });
    expect(screen.getByText(movingHintWords(WHITE.name, WHITE.positions))).toBeTruthy();
  });

  it("drags a starter onto the bench", async () => {
    await openedPitch();
    const dataTransfer = { setData: () => undefined, effectAllowed: "" };
    fireEvent.dragStart(blockOf(HAVERTZ, { area: "attack", lane: "centre" }), { dataTransfer });
    fireEvent.drop(screen.getByText(BENCH_TITLE), { dataTransfer });
    expect(squadRows().at(-1)).toBe("STHavertz ARSMove Up Down");
  });
});

describe("the bench order (spec/05 Auto-subs; Craig, 26 Oct 2026)", () => {
  const up = (player: Member) => screen.getByRole("button", { name: upLabel(player.name) });
  const down = (player: Member) => screen.getByRole("button", { name: downLabel(player.name) });
  const benchNames = () => squadRows().slice(squadRows().indexOf(BENCH_TITLE) + 1);

  it("Up and Down move a bench player one place, and neither runs off the end", async () => {
    await openedPitch();
    expect(up(ARRIZABALAGA).hasAttribute("disabled")).toBe(true);
    expect(down(WHITE).hasAttribute("disabled")).toBe(true);
    await userEvent.click(down(ARRIZABALAGA));
    expect(benchNames().map((row) => row.split(" ARS")[0])).toEqual(["FB, WBWhite", "GKArrizabalaga"]);
    await userEvent.click(up(ARRIZABALAGA));
    expect(benchNames().map((row) => row.split(" ARS")[0])).toEqual(["GKArrizabalaga", "FB, WBWhite"]);
  });

  it("a starter dragged onto a bench row takes its place there", async () => {
    await openedPitch();
    const dataTransfer = { setData: () => undefined, effectAllowed: "" };
    fireEvent.dragStart(blockOf(HAVERTZ, { area: "attack", lane: "centre" }), { dataTransfer });
    const whitesRow = down(WHITE).closest("tr")!;
    fireEvent.dragOver(whitesRow, { dataTransfer });
    fireEvent.drop(whitesRow, { dataTransfer });
    expect(benchNames().map((row) => row.split(" ARS")[0])).toEqual(["GKArrizabalaga", "STHavertz", "FB, WBWhite"]);
  });

  it("a bench player dragged along the bench takes the place he is dropped on, earlier or later", async () => {
    await openedPitch();
    const dataTransfer = { setData: () => undefined, effectAllowed: "" };
    const dragOnto = (player: Member, onto: Member) => {
      fireEvent.dragStart(down(player).closest("tr")!, { dataTransfer });
      const row = down(onto).closest("tr")!;
      fireEvent.dragOver(row, { dataTransfer });
      fireEvent.drop(row, { dataTransfer });
    };
    dragOnto(WHITE, ARRIZABALAGA);
    expect(benchNames().map((row) => row.split(" ARS")[0])).toEqual(["FB, WBWhite", "GKArrizabalaga"]);
    dragOnto(WHITE, ARRIZABALAGA);
    expect(benchNames().map((row) => row.split(" ARS")[0])).toEqual(["GKArrizabalaga", "FB, WBWhite"]);
  });

  it("a drop on a bench row with nobody picked up changes nothing", async () => {
    const app = await openedPitch();
    fireEvent.drop(down(WHITE).closest("tr")!, { dataTransfer: { setData: () => undefined, effectAllowed: "" } });
    expect(benchNames().map((row) => row.split(" ARS")[0])).toEqual(["GKArrizabalaga", "FB, WBWhite"]);
    expect(app.myTeam.lineupChanges.save).not.toHaveBeenCalled();
  });

  it("Up and Down keep the focus on the button pressed, or its partner once it stops at an end", async () => {
    await openedPitch();
    await userEvent.click(up(WHITE));
    expect(document.activeElement).toBe(down(WHITE));
    await userEvent.click(down(WHITE));
    expect(document.activeElement).toBe(up(WHITE));
  });

  it("in the middle of the bench the button pressed keeps the focus", async () => {
    await openedPitch();
    const dataTransfer = { setData: () => undefined, effectAllowed: "" };
    fireEvent.dragStart(blockOf(HAVERTZ, { area: "attack", lane: "centre" }), { dataTransfer });
    fireEvent.drop(screen.getByText(BENCH_TITLE), { dataTransfer });
    await userEvent.click(down(ARRIZABALAGA));
    expect(benchNames().map((row) => row.split(" ARS")[0])).toEqual(["FB, WBWhite", "GKArrizabalaga", "STHavertz"]);
    expect(document.activeElement).toBe(down(ARRIZABALAGA));
  });

  it("saves itself as it stands", async () => {
    const app = await openedPitch();
    await userEvent.click(up(WHITE));
    expect(app.myTeam.lineupChanges.save).toHaveBeenCalledWith(league.leagueId, { starters: STARTERS, bench: [WHITE.playerCode, ARRIZABALAGA.playerCode] });
  });
});
