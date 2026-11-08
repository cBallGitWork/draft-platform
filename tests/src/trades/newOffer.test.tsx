// Trades' New offer tab (#383; docs/design/approved/trades/1440-new.png): both squads with ticks,
// the team to trade with picked in Their squad's plate (no team on the auto team), a player held in
// a trade under review greyed and not tickable, the offer summed up with a one-line note, and Send
// offer, which goes back to Offers once made. Counter opens it filled with the offer it answers.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TRADES_NEW_PATH, TRADES_PATH } from "../../../src/frame/menu";
import {
  heldWords,
  noteLabel,
  partnerLabel,
  sendCounterWords,
  sendOfferWords,
  squadTableLabel,
  tickLabel,
  YOUR_OFFER_TITLE,
} from "../../../src/trades/words";
import { league, manager, openApp } from "../../support/src/shell.harness";
import {
  JAMES,
  MY_TEAM,
  PALMER,
  quietTrades,
  RICE,
  SAKA,
  screenOffer,
  screenTeam,
  THEIR_TEAM,
  type TradesData,
} from "../../support/src/trades.harness";

const openNewOffer = (trades: TradesData = {}, path = TRADES_NEW_PATH) =>
  openApp(path, manager, { trades });
const tick = async (team: string, name: string) =>
  userEvent.click(
    within(
      await screen.findByRole("table", { name: squadTableLabel(team) }),
    ).getByRole("checkbox", { name: tickLabel(name) }),
  );

describe("a new offer", () => {
  it("ticks players on either side, carries a note, and is sent, back to Offers", async () => {
    const app = openNewOffer();
    await tick("Team 1", SAKA.name);
    await tick("Team 2", PALMER.name);
    await userEvent.type(
      screen.getByRole("textbox", { name: noteLabel }),
      "Fancy it?",
    );
    const summary = screen.getByRole("region", { name: YOUR_OFFER_TITLE });
    expect(summary.textContent).toContain("2 of 20 after it");
    await userEvent.click(screen.getByRole("button", { name: sendOfferWords }));
    expect(app.trades.offer).toHaveBeenCalledWith(league.leagueId, THEIR_TEAM, {
      gives: [SAKA.code],
      gets: [PALMER.code],
      note: "Fancy it?",
    });
    expect(app.path()).toBe(TRADES_PATH);
  });

  it("can't be sent with nobody ticked, and stays put when refused", async () => {
    const app = openNewOffer({
      refusal: "Saka is in another trade under review.",
    });
    expect(
      (
        await screen.findByRole<HTMLButtonElement>("button", {
          name: sendOfferWords,
        })
      ).disabled,
    ).toBe(true);
    await tick("Team 2", JAMES.name);
    await userEvent.click(screen.getByRole("button", { name: sendOfferWords }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Saka is in another trade under review.",
    );
    expect(app.path()).toBe(TRADES_NEW_PATH);
  });

  it("greys a held player, who can't be ticked", async () => {
    openNewOffer({
      view: {
        ...quietTrades,
        teams: [
          {
            ...screenTeam(MY_TEAM, "Team 1", [SAKA]),
            players: [{ ...SAKA, held: true }],
          },
          quietTrades.teams[1],
        ],
      },
    });
    const table = await screen.findByRole("table", {
      name: squadTableLabel("Team 1"),
    });
    expect(
      within(table).getByRole<HTMLInputElement>("checkbox", {
        name: tickLabel(SAKA.name),
      }).disabled,
    ).toBe(true);
    expect(within(table).getByText(heldWords)).toBeTruthy();
  });

  it("offers no team on the auto team, and changing team clears their ticks", async () => {
    const third = screenTeam("team-3" as never, "Team 3", [RICE]);
    const auto = screenTeam("team-4" as never, "Team 4", [], {
      onAutoTeam: true,
    });
    openNewOffer({
      view: { ...quietTrades, teams: [...quietTrades.teams, third, auto] },
    });
    const picker = await screen.findByRole<HTMLSelectElement>("combobox", {
      name: partnerLabel,
    });
    expect(Array.from(picker.options, (option) => option.text)).toEqual([
      "Team 2",
      "Team 3",
    ]);
    await tick("Team 2", PALMER.name);
    await userEvent.selectOptions(picker, "Team 3");
    expect(
      screen.getByRole("region", { name: YOUR_OFFER_TITLE }).textContent,
    ).not.toContain(PALMER.name);
  });
});

describe("a counter", () => {
  it("is filled with the offer it answers, its team fixed, and sent as a counter", async () => {
    const app = openNewOffer(
      { view: { ...quietTrades, offers: [screenOffer()] } },
      `${TRADES_NEW_PATH}?counter=offer-1`,
    );
    const picker = await screen.findByRole<HTMLSelectElement>("combobox", {
      name: partnerLabel,
    });
    expect(picker.disabled).toBe(true);
    expect(
      screen.getByRole<HTMLInputElement>("checkbox", {
        name: tickLabel(SAKA.name),
      }).checked,
    ).toBe(true);
    await tick("Team 2", JAMES.name);
    await userEvent.click(
      screen.getByRole("button", { name: sendCounterWords }),
    );
    expect(app.trades.counter).toHaveBeenCalledWith(
      league.leagueId,
      "offer-1",
      { gives: [SAKA.code], gets: [PALMER.code, JAMES.code], note: null },
    );
  });
});
