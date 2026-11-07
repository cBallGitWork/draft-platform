// My team's Tactics tab (#14; spec/05, The pitch; the approved Tactics picture): a player tapped
// (a click, a tap, Enter) opens his panel, whose Move picks him up, or he is dragged; then swapped
// with a lit player, never moved into an empty cell (presets only; #1022; refused drops and a back
// five's swaps are in tactics.swapping.test.tsx); and the bench put in order from a bench player's
// panel.

import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  downLabel,
  moveLabel,
  movingHintWords,
  playerCardLabel,
  pickHintWords,
  roleLabel,
  selectionTableLabel,
  startingWords,
  swapLabel,
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
  allSwaps,
  at,
  blockOf,
  benchOrder,
  cellOn,
  drag,
  openPanel,
  openTacticsTab,
  openedPitch,
  pickUp,
  pitch,
  rowOf,
  squadRows,
  swap,
  swaps,
  type Member,
} from "../../../support/src/tacticsScreen.harness";
import { openTactics } from "../../../support/src/tactics.harness";

const SALIBAS_CELL = { area: "defence", lane: "leftCentre" } as const;

describe("moving a player", () => {
  it("picked up from the bench, lights only the starters he can swap with, and swaps with one", async () => {
    openTacticsTab();
    await pickUp(WHITE);

    expect(screen.getByText(movingHintWords(WHITE.name, WHITE.positions))).toBeTruthy();
    // A full back plays all of defence, where only Saliba stands; no empty cell lights.
    expect(swaps()).toEqual([swapLabel(WHITE.name, SALIBA.name)]);
    expect(within(pitch()).queryAllByRole("button", { name: /^Put / })).toEqual([]);

    await userEvent.click(within(pitch()).getByRole("button", { name: swapLabel(WHITE.name, SALIBA.name) }));
    expect(document.activeElement).toBe(blockOf(WHITE, SALIBAS_CELL));
    expect(swaps()).toEqual([]);
    expect(screen.getByText(pickHintWords)).toBeTruthy();
    expect(screen.getByText(startingWords(STARTERS.length))).toBeTruthy();
    expect(benchOrder()).toEqual([ARRIZABALAGA.name, SALIBA.name]);
  });

  it("swapped in, starts on the role he has the most stars for there (#11)", async () => {
    const starred: Member = { ...WHITE, stars: [{ area: "defence", role: "ballPlayingDefender", stars: 4 }] };
    openTacticsTab({ tactics: openTactics({ ...SAVED, squad: SQUAD.map((each) => (each === WHITE ? starred : each)) }) });
    await swap(WHITE, SALIBA);

    expect((screen.getByRole("combobox", { name: roleLabel(WHITE.name) }) as HTMLSelectElement).value).toBe("ballPlayingDefender");
  });

  it("a starter picked up by Move in the panel a tap on him opens lights the bench players he can swap with", async () => {
    await openedPitch();
    await userEvent.click(blockOf(SALIBA, SALIBAS_CELL));
    expect(blockOf(SALIBA, SALIBAS_CELL).getAttribute("aria-pressed")).toBe("true");
    // Open, his panel lights nothing: Move picks him up.
    expect(allSwaps()).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: moveLabel(SALIBA.name) }));
    expect(allSwaps()).toEqual([swapLabel(SALIBA.name, WHITE.name)]);
  });

  it("a keeper lights only the other keeper, and an outfield player no keeper", async () => {
    await openedPitch();
    await pickUp(ARRIZABALAGA);
    // Raya is lit on the pitch and in his row; nobody else is lit anywhere.
    expect(new Set(allSwaps())).toEqual(new Set([swapLabel(ARRIZABALAGA.name, RAYA.name)]));

    await pickUp(SALIBA);
    expect(allSwaps().some((label) => label?.includes(RAYA.name) || label?.includes(ARRIZABALAGA.name))).toBe(false);
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
    const LEFT_BACK = { area: "defence", lane: "left" } as const;
    const withWhite = openTactics({ ...SAVED, lineup: { ...SAVED.lineup, starters: [...STARTERS, at(WHITE, LEFT_BACK)], bench: [ARRIZABALAGA.playerCode] } });
    await openedPitch({ tactics: withWhite });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: roleLabel(SALIBA.name) }), "ballPlayingDefender");
    drag(blockOf(SALIBA, SALIBAS_CELL), cellOn(LEFT_BACK));
    expect(blockOf(SALIBA, LEFT_BACK)).toBeTruthy();
    expect(blockOf(WHITE, SALIBAS_CELL)).toBeTruthy();
    expect((screen.getByRole("combobox", { name: roleLabel(SALIBA.name) }) as HTMLSelectElement).value).not.toBe("ballPlayingDefender");
  });

  it("swaps a starter with a lit bench player from the squad", async () => {
    await openedPitch();
    await pickUp(RAYA);
    // Only the other keeper plays goal: White isn't lit.
    expect(screen.queryByRole("button", { name: swapLabel(RAYA.name, WHITE.name) })).toBeNull();
    const table = screen.getByRole("table", { name: selectionTableLabel });
    await userEvent.click(within(table).getByRole("button", { name: swapLabel(RAYA.name, ARRIZABALAGA.name) }));
    expect(blockOf(ARRIZABALAGA, { area: "goalkeeper", lane: "centre" })).toBeTruthy();
  });

  it("works from the keyboard: Enter opens his panel, Enter on Move picks him up, Escape puts him back", async () => {
    await openedPitch();
    blockOf(SALIBA, SALIBAS_CELL).focus();
    await userEvent.keyboard("{Enter}");
    screen.getByRole("button", { name: moveLabel(SALIBA.name) }).focus();
    await userEvent.keyboard("{Enter}");
    expect(allSwaps().length).toBeGreaterThan(0);
    await userEvent.keyboard("{Escape}");
    expect(allSwaps()).toEqual([]);
    expect(screen.getByText(pickHintWords)).toBeTruthy();
  });

  it("dragging a player already picked up keeps him picked up", async () => {
    await openedPitch();
    await pickUp(WHITE);
    fireEvent.dragStart(rowOf(WHITE), { dataTransfer: { setData: () => undefined, effectAllowed: "" } });
    expect(screen.getByText(movingHintWords(WHITE.name, WHITE.positions))).toBeTruthy();
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

  it("a bench player dragged along the bench takes the place he is dropped on, earlier or later", async () => {
    await openedPitch();
    drag(rowOf(WHITE), rowOf(ARRIZABALAGA));
    expect(benchOrder()).toEqual([WHITE.name, ARRIZABALAGA.name]);
    drag(rowOf(WHITE), rowOf(ARRIZABALAGA));
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
    const threeOnTheBench = openTactics({ ...SAVED, lineup: { ...SAVED.lineup, starters: STARTERS.slice(0, 3), bench: [ARRIZABALAGA.playerCode, WHITE.playerCode, HAVERTZ.playerCode] } });
    await openedPitch({ tactics: threeOnTheBench });
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
    // Each with his stars for it: none here, so "—".
    expect(roles.map((role) => role.textContent)).toEqual(["Stoppernow—", "Ball-playing centre-back—", "No-nonsense centre-back—", "Attacking centre-back—"]);
    expect(roles[0].getAttribute("aria-current")).toBe("true");
  });

  it("has no Move column in the table: what can be done to a player is in his panel", async () => {
    await openedPitch();
    expect(within(screen.getByRole("table", { name: selectionTableLabel })).queryByRole("button", { name: moveLabel(WHITE.name) })).toBeNull();
    expect(squadRows().some((row) => row.includes("Move"))).toBe(false);
  });
});
