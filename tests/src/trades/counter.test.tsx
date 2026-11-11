// Trades' Counter (#383): New offer filled with the offer it answers, its team fixed, and sent as a
// counter; a player held in another trade under review is left out of it, greyed and unticked, as
// from a player card (#1483). The plain new offer is in newOffer.test.tsx.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TRADES_NEW_PATH } from "../../../src/frame/menu";
import {
  partnerLabel,
  picksTableLabel,
  pickTickLabel,
  sendCounterWords,
  squadTableLabel,
  tickLabel,
} from "../../../src/trades/words";
import { league, manager, openApp } from "../../support/src/shell.harness";
import {
  JAMES,
  MY_TEAM,
  PALMER,
  quietTrades,
  SAKA,
  screenOffer,
  THEIR_TEAM,
  type TradesData,
} from "../../support/src/trades.harness";

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

  describe("to a pick offer (#1471)", () => {
    // Before the draft: Team 2 offers its round 2 pick for Team 1's round 3 pick; each also holds
    // its own round 1 pick.
    const [mine, theirs] = quietTrades.teams;
    const pick = (round: number, teamId: typeof MY_TEAM, teamName: string, held = false) => ({ round, teamId, teamName, held });
    const beforeDraft = (held = false) => ({
      ...quietTrades,
      teams: [
        { ...mine, picks: [pick(1, MY_TEAM, "Team 1"), pick(3, MY_TEAM, "Team 1", held)] },
        { ...theirs, picks: [pick(1, THEIR_TEAM, "Team 2"), pick(2, THEIR_TEAM, "Team 2")] },
      ],
      offers: [
        screenOffer({
          gives: [],
          gets: [],
          picks: { gives: "Team 2's round 2 pick", gets: "Team 1's round 3 pick" },
          pickTerms: { gives: { round: 2, teamId: THEIR_TEAM }, gets: { round: 3, teamId: MY_TEAM } },
        }),
      ],
    });
    const pickBox = async (team: string, round: number) =>
      within(await screen.findByRole("table", { name: picksTableLabel(team) })).getByRole<HTMLInputElement>("checkbox", {
        name: pickTickLabel(round, team),
      });

    it("starts with its picks ticked from his side, and is sent as a counter, which closes it", async () => {
      const app = openCounter({ view: beforeDraft() });
      expect((await pickBox("Team 1", 3)).checked).toBe(true);
      expect((await pickBox("Team 2", 2)).checked).toBe(true);
      await userEvent.click(await pickBox("Team 2", 1));
      await userEvent.click(screen.getByRole("button", { name: sendCounterWords }));
      expect(app.trades.counter).toHaveBeenCalledWith(league.leagueId, "offer-1", {
        gives: [],
        gets: [],
        picks: { gives: { round: 3, teamId: MY_TEAM }, gets: { round: 1, teamId: THEIR_TEAM } },
        note: null,
      });
      expect(app.trades.offer).not.toHaveBeenCalled();
    });

    it("can be countered with players only", async () => {
      const app = openCounter({ view: beforeDraft() });
      await userEvent.click(await box("Team 2", PALMER.name));
      expect((await pickBox("Team 1", 3)).checked).toBe(false);
      await userEvent.click(screen.getByRole("button", { name: sendCounterWords }));
      expect(app.trades.counter).toHaveBeenCalledWith(league.leagueId, "offer-1", {
        gives: [],
        gets: [PALMER.code],
        note: null,
      });
    });

    it("starts without a pick held in another trade under review", async () => {
      openCounter({ view: beforeDraft(true) });
      const held = await pickBox("Team 1", 3);
      expect(held.checked).toBe(false);
      expect(held.disabled).toBe(true);
      expect((await pickBox("Team 2", 2)).checked).toBe(true);
    });
  });
});
