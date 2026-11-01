// My team's Tactics tab (#14; spec/05, The pitch; the approved Tactics picture): a player tapped
// (a click, a tap, Enter) opens his panel, whose Move picks him up, or he is dragged; then put in a
// free cell he plays or on the bench; and the bench put in order from a bench player's panel.

import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  BENCH_TITLE,
  downLabel,
  moveLabel,
  movingHintWords,
  playerCardLabel,
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
  SAVED,
  SQUAD,
  STARTERS,
  WHITE,
  at,
  blockOf,
  benchOrder,
  openPanel,
  openTacticsTab,
  openedPitch,
  pickUp,
  pitch,
  rowOf,
  squadRows,
  swaps,
  targets,
  type Member,
} from "../../../support/src/tacticsScreen.harness";
import { openTactics } from "../../../support/src/tactics.harness";

describe("moving a player", () => {
  it("picked up from the bench, is offered only the free cells he plays, and put in one", async () => {
    openTacticsTab();
    await pickUp(WHITE);

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

  it("put in a free cell, starts on the role he has the most stars for there (#11)", async () => {
    const starred: Member = { ...WHITE, stars: [{ area: "defence", role: "attackingFullBack", stars: 4 }] };
    openTacticsTab({ tactics: openTactics({ ...SAVED, squad: SQUAD.map((each) => (each === WHITE ? starred : each)) }) });
    await pickUp(WHITE);
    await userEvent.click(screen.getByRole("button", { name: putHereLabel(WHITE.name, "defence", "right") }));

    expect((screen.getByRole("combobox", { name: roleLabel(WHITE.name) }) as HTMLSelectElement).value).toBe("attackingFullBack");
  });

  it("moves a starter to another free cell in his area, picked up by Move in the panel a tap on him opens", async () => {
    await openedPitch();
    await userEvent.click(blockOf(SALIBA, { area: "defence", lane: "leftCentre" }));
    expect(blockOf(SALIBA, { area: "defence", lane: "leftCentre" }).getAttribute("aria-pressed")).toBe("true");
    // Open, his panel lights nothing: Move picks him up.
    expect(targets()).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: moveLabel(SALIBA.name) }));
    await userEvent.click(screen.getByRole("button", { name: putHereLabel(SALIBA.name, "defence", "rightCentre") }));
    expect(blockOf(SALIBA, { area: "defence", lane: "rightCentre" })).toBeTruthy();
  });

  it("lights no free cell that breaks the area limits: a second keeper only swaps with the first", async () => {
    await openedPitch();
    await pickUp(ARRIZABALAGA);
    // The first rules start one keeper, no more and no fewer.
    expect(targets()).toEqual([]);
    expect(swaps()).toEqual([swapLabel(ARRIZABALAGA.name, RAYA.name)]);

    await pickUp(SALIBA);
    expect(targets().some((label) => label?.includes("Goalkeeper"))).toBe(false);
    expect(swaps()).toEqual([]);
  });

  it("swaps a bench player for a starter by a tap on the lit starter: the starter takes his place on the bench", async () => {
    const app = await openedPitch();
    await pickUp(ARRIZABALAGA);
    await userEvent.click(within(pitch()).getByRole("button", { name: swapLabel(ARRIZABALAGA.name, RAYA.name) }));
    expect(document.activeElement).toBe(blockOf(ARRIZABALAGA, { area: "goalkeeper", lane: "centre" }));
    expect(app.myTeam.lineupChanges.save).toHaveBeenLastCalledWith(league.leagueId, {
      starters: [at(ARRIZABALAGA, { area: "goalkeeper", lane: "centre" }), ...STARTERS.slice(1)],
      bench: [RAYA.playerCode, WHITE.playerCode],
    });
  });

  it("swaps two starters, each into the other's cell on its first role, by a drop of one on the other", async () => {
    await openedPitch();
    await pickUp(WHITE);
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
    await pickUp(RAYA);
    // Only the other keeper plays goal: White isn't lit.
    expect(screen.queryByRole("button", { name: swapLabel(RAYA.name, WHITE.name) })).toBeNull();
    const table = screen.getByRole("table", { name: squadTableLabel });
    await userEvent.click(within(table).getByRole("button", { name: swapLabel(RAYA.name, ARRIZABALAGA.name) }));
    expect(blockOf(ARRIZABALAGA, { area: "goalkeeper", lane: "centre" })).toBeTruthy();
  });

  it("works from the keyboard: Enter opens his panel, Enter on Move picks him up, Escape puts him back", async () => {
    await openedPitch();
    blockOf(SALIBA, { area: "defence", lane: "leftCentre" }).focus();
    await userEvent.keyboard("{Enter}");
    screen.getByRole("button", { name: moveLabel(SALIBA.name) }).focus();
    await userEvent.keyboard("{Enter}");
    expect(targets().length).toBeGreaterThan(0);
    await userEvent.keyboard("{Escape}");
    expect(targets()).toEqual([]);
    expect(screen.getByText(pickHintWords)).toBeTruthy();
  });

  it("puts a picked-up starter on the bench, at its end", async () => {
    await openedPitch();
    await pickUp(RICE);
    await userEvent.click(screen.getByRole("button", { name: toBenchWords(RICE.name) }));
    expect(benchOrder().at(-1)).toBe(RICE.name);
    expect(within(pitch()).queryByRole("button", { name: new RegExp(`^${RICE.name},`) })).toBeNull();
  });

  it("drags from the bench onto a free cell he plays", async () => {
    openTacticsTab();
    await screen.findByRole("group", { name: /pitch/ });
    const row = rowOf(WHITE);
    const dataTransfer = { setData: () => undefined, effectAllowed: "" };
    fireEvent.dragStart(row, { dataTransfer });
    const cell = screen.getByRole("button", { name: putHereLabel(WHITE.name, "defence", "left") }).parentElement!;
    fireEvent.dragOver(cell, { dataTransfer });
    fireEvent.drop(cell, { dataTransfer });
    expect(blockOf(WHITE, { area: "defence", lane: "left" })).toBeTruthy();
  });

  it("dragging a player already picked up keeps him picked up", async () => {
    await openedPitch();
    await pickUp(WHITE);
    fireEvent.dragStart(rowOf(WHITE), { dataTransfer: { setData: () => undefined, effectAllowed: "" } });
    expect(screen.getByText(movingHintWords(WHITE.name, WHITE.positions))).toBeTruthy();
  });

  it("drags a starter onto the bench", async () => {
    await openedPitch();
    const dataTransfer = { setData: () => undefined, effectAllowed: "" };
    fireEvent.dragStart(blockOf(HAVERTZ, { area: "attack", lane: "centre" }), { dataTransfer });
    fireEvent.drop(screen.getByText(BENCH_TITLE), { dataTransfer });
    expect(benchOrder().at(-1)).toBe(HAVERTZ.name);
  });
});

describe("the bench order (spec/05 Auto-subs; Craig, 26 Oct 2026)", () => {
  // Up and Down are in a bench player's panel, opened by a tap on him.
  const up = (player: Member) => screen.getByRole("button", { name: upLabel(player.name) });
  const down = (player: Member) => screen.getByRole("button", { name: downLabel(player.name) });

  it("Up and Down move a bench player one place, and neither runs off the end", async () => {
    await openedPitch();
    await openPanel(ARRIZABALAGA);
    expect(up(ARRIZABALAGA).hasAttribute("disabled")).toBe(true);
    await openPanel(WHITE);
    expect(down(WHITE).hasAttribute("disabled")).toBe(true);
    await openPanel(ARRIZABALAGA);
    await userEvent.click(down(ARRIZABALAGA));
    expect(benchOrder()).toEqual([WHITE.name, ARRIZABALAGA.name]);
    await userEvent.click(up(ARRIZABALAGA));
    expect(benchOrder()).toEqual([ARRIZABALAGA.name, WHITE.name]);
  });

  it("a starter dragged onto a bench row takes its place there", async () => {
    await openedPitch();
    const dataTransfer = { setData: () => undefined, effectAllowed: "" };
    fireEvent.dragStart(blockOf(HAVERTZ, { area: "attack", lane: "centre" }), { dataTransfer });
    const whitesRow = rowOf(WHITE);
    fireEvent.dragOver(whitesRow, { dataTransfer });
    fireEvent.drop(whitesRow, { dataTransfer });
    expect(benchOrder()).toEqual([ARRIZABALAGA.name, HAVERTZ.name, WHITE.name]);
  });

  it("a bench player dragged along the bench takes the place he is dropped on, earlier or later", async () => {
    await openedPitch();
    const dataTransfer = { setData: () => undefined, effectAllowed: "" };
    const dragOnto = (player: Member, onto: Member) => {
      fireEvent.dragStart(rowOf(player), { dataTransfer });
      const row = rowOf(onto);
      fireEvent.dragOver(row, { dataTransfer });
      fireEvent.drop(row, { dataTransfer });
    };
    dragOnto(WHITE, ARRIZABALAGA);
    expect(benchOrder()).toEqual([WHITE.name, ARRIZABALAGA.name]);
    dragOnto(WHITE, ARRIZABALAGA);
    expect(benchOrder()).toEqual([ARRIZABALAGA.name, WHITE.name]);
  });

  it("a drop on a bench row with nobody picked up changes nothing", async () => {
    const app = await openedPitch();
    fireEvent.drop(rowOf(WHITE), { dataTransfer: { setData: () => undefined, effectAllowed: "" } });
    expect(benchOrder()).toEqual([ARRIZABALAGA.name, WHITE.name]);
    expect(app.myTeam.lineupChanges.save).not.toHaveBeenCalled();
  });

  it("Up and Down keep the focus on the button pressed, or its partner once it stops at an end", async () => {
    await openedPitch();
    await openPanel(WHITE);
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
    await openPanel(ARRIZABALAGA);
    await userEvent.click(down(ARRIZABALAGA));
    expect(benchOrder()).toEqual([WHITE.name, ARRIZABALAGA.name, HAVERTZ.name]);
    expect(document.activeElement).toBe(down(ARRIZABALAGA));
  });

  it("saves itself as it stands", async () => {
    const app = await openedPitch();
    await openPanel(WHITE);
    await userEvent.click(up(WHITE));
    expect(app.myTeam.lineupChanges.save).toHaveBeenCalledWith(league.leagueId, { starters: STARTERS, bench: [WHITE.playerCode, ARRIZABALAGA.playerCode] });
  });
});

describe("the selected player's panel (the approved Tactics picture)", () => {
  it("opens on a tap on him, in the pitch or a row, says where he stands, and closes with its cross", async () => {
    await openedPitch();
    await userEvent.click(blockOf(RICE, { area: "midfield", lane: "centre" }));
    const panel = screen.getByRole("region", { name: RICE.name });
    expect(within(panel).getByText("ARS, CM")).toBeTruthy();
    expect(within(panel).getByRole("link", { name: playerCardLabel(RICE.name) })).toBeTruthy();
    // A starter has no bench order to change.
    expect(within(panel).queryByRole("button", { name: upLabel(RICE.name) })).toBeNull();
    await userEvent.click(within(panel).getByRole("button", { name: /^Close/ }));
    expect(screen.queryByRole("region", { name: RICE.name })).toBeNull();

    await openPanel(WHITE);
    expect(within(screen.getByRole("region", { name: WHITE.name })).getByText("ARS, S2")).toBeTruthy();
  });

  it("lists his slot's roles, the one he plays marked", async () => {
    await openedPitch();
    await openPanel(SALIBA);
    const roles = within(screen.getByRole("region", { name: SALIBA.name })).getAllByRole("listitem");
    expect(roles.map((role) => role.textContent)).toEqual(["Stoppernow", "Ball-playing defender"]);
    expect(roles[0].getAttribute("aria-current")).toBe("true");
  });

  it("has no Move column in the table: what can be done to a player is in his panel", async () => {
    await openedPitch();
    expect(within(screen.getByRole("table", { name: squadTableLabel })).queryByRole("button", { name: moveLabel(WHITE.name) })).toBeNull();
    expect(squadRows()).not.toContain(expect.stringContaining("Move"));
  });
});
