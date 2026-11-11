// Trades' Counter (#383): New offer filled with the offer it answers, its team fixed, and sent as a
// counter; a player held in another trade under review is left out of it, greyed and unticked, as
// from a player card (#1483). The plain new offer is in newOffer.test.tsx.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TRADES_NEW_PATH } from "../../../src/frame/menu";
import { partnerLabel, sendCounterWords, squadTableLabel, tickLabel } from "../../../src/trades/words";
import { league, manager, openApp } from "../../support/src/shell.harness";
import { JAMES, PALMER, quietTrades, SAKA, screenOffer, type TradesData } from "../../support/src/trades.harness";

const openCounter = (trades: TradesData) => openApp(`${TRADES_NEW_PATH}?counter=offer-1`, manager, { trades });
const box = async (team: string, name: string) =>
  within(await screen.findByRole("table", { name: squadTableLabel(team) })).getByRole<HTMLInputElement>("checkbox", {
    name: tickLabel(name),
  });

describe("a counter", () => {
  it("is filled with the offer it answers, its team fixed, and sent as a counter", async () => {
    const app = openCounter({ view: { ...quietTrades, offers: [screenOffer()] } });
    const picker = await screen.findByRole<HTMLSelectElement>("combobox", { name: partnerLabel });
    expect(picker.disabled).toBe(true);
    expect((await box("Team 1", SAKA.name)).checked).toBe(true);
    await userEvent.click(await box("Team 2", JAMES.name));
    await userEvent.click(screen.getByRole("button", { name: sendCounterWords }));
    expect(app.trades.counter).toHaveBeenCalledWith(league.leagueId, "offer-1", {
      gives: [SAKA.code],
      gets: [PALMER.code, JAMES.code],
      note: null,
    });
  });

  it("starts without a player held in another trade under review, greyed and unticked (#1483)", async () => {
    const [mine, theirs] = quietTrades.teams;
    const held = { ...mine, players: mine.players.map((each) => (each.code === SAKA.code ? { ...each, held: true } : each)) };
    openCounter({ view: { ...quietTrades, teams: [held, theirs], offers: [screenOffer()] } });
    const saka = await box("Team 1", SAKA.name);
    expect(saka.checked).toBe(false);
    expect(saka.disabled).toBe(true);
    expect((await box("Team 2", PALMER.name)).checked).toBe(true);
  });
});
