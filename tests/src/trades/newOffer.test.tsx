// Trades' New offer tab (#383; docs/design/approved/trades/1440-new.png): both squads with ticks,
// the team to trade with picked in Their squad's plate (no team on the auto team), a player held in
// a trade under review greyed and not tickable, the offer summed up with a one-line note, and Send
// offer, which goes back to Offers once made. Counter opens it filled with the offer it answers.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TRADES_NEW_PATH, TRADES_PATH } from "../../../src/frame/menu";
import {
  groupWords,
  noteLabel,
  onePickEachWords,
  partnerLabel,
  pickRoundWords,
  picksTableLabel,
  pickTickLabel,
  pickWords,
  viaWords,
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
    expect(within(table).getByText(groupWords.inReview)).toBeTruthy();
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

describe("a pick offer (#1096)", () => {
  // Before the draft: Team 1 holds its own round-1 pick and Team 2's round-2 pick, which is in a
  // trade under review; Team 2 its own round-1 pick.
  const ONE = { round: 1, teamId: MY_TEAM, teamName: "Team 1", held: false };
  const VIA = { round: 2, teamId: THEIR_TEAM, teamName: "Team 2", held: true };
  const THEIRS = {
    round: 1,
    teamId: THEIR_TEAM,
    teamName: "Team 2",
    held: false,
  };
  const beforeDraft = {
    ...quietTrades,
    teams: [
      screenTeam(MY_TEAM, "Team 1", [SAKA, RICE], { picks: [ONE, VIA] }),
      screenTeam(THEIR_TEAM, "Team 2", [PALMER, JAMES], { picks: [THEIRS] }),
    ],
  };
  const picksTable = async (team: string) =>
    within(await screen.findByRole("table", { name: picksTableLabel(team) }));
  const tickPick = async (team: string, round: number, of: string) =>
    userEvent.click(
      (await picksTable(team)).getByRole("checkbox", {
        name: pickTickLabel(round, of),
      }),
    );
  const send = () =>
    screen.getByRole<HTMLButtonElement>("button", { name: sendOfferWords });

  it("lists each team's picks under its squad, one traded to it via its team, one in review greyed", async () => {
    openNewOffer({ view: beforeDraft });
    const mine = await picksTable("Team 1");
    const [own, via] = mine.getAllByRole("rowheader");
    expect(own.textContent).toBe(pickRoundWords(1));
    expect(via.textContent).toBe(
      `${pickRoundWords(2)}${viaWords("Team 2")}${groupWords.inReview}`,
    );
    expect(
      mine.getByRole<HTMLInputElement>("checkbox", {
        name: pickTickLabel(2, "Team 2"),
      }).disabled,
    ).toBe(true);
  });

  it("is one pick each way and nothing else, sent with both picks", async () => {
    const app = openNewOffer({ view: beforeDraft });
    await tick("Team 1", SAKA.name);
    await tickPick("Team 1", 1, "Team 1");
    // Ticking a pick clears the players.
    expect(
      screen.getByRole<HTMLInputElement>("checkbox", {
        name: tickLabel(SAKA.name),
      }).checked,
    ).toBe(false);
    expect(send().disabled).toBe(true);
    expect(screen.getByText(onePickEachWords)).toBeTruthy();
    await tickPick("Team 2", 1, "Team 2");
    const summary = screen.getByRole("region", { name: YOUR_OFFER_TITLE });
    expect(summary.textContent).toContain(pickWords(1, "Team 2"));
    expect(summary.textContent).toContain(pickWords(1, "Team 1"));
    await userEvent.click(send());
    expect(app.trades.offer).toHaveBeenCalledWith(league.leagueId, THEIR_TEAM, {
      gives: [],
      gets: [],
      picks: {
        gives: { round: 1, teamId: MY_TEAM },
        gets: { round: 1, teamId: THEIR_TEAM },
      },
      note: null,
    });
  });

  it("drops its picks once a player is ticked", async () => {
    openNewOffer({ view: beforeDraft });
    await tickPick("Team 1", 1, "Team 1");
    await tickPick("Team 2", 1, "Team 2");
    await tick("Team 2", PALMER.name);
    expect(
      (await picksTable("Team 2")).getByRole<HTMLInputElement>("checkbox")
        .checked,
    ).toBe(false);
    expect(
      (await picksTable("Team 1")).getByRole<HTMLInputElement>("checkbox", {
        name: pickTickLabel(1, "Team 1"),
      }).checked,
    ).toBe(false);
  });

  it("shows no Picks block once the draft has started", async () => {
    openNewOffer();
    await screen.findByRole("table", { name: squadTableLabel("Team 1") });
    expect(
      screen.queryByRole("table", { name: picksTableLabel("Team 1") }),
    ).toBeNull();
  });
});

describe("from a player card's Offer a trade (#1027)", () => {
  const fromCard = (team: string, player: number, trades: TradesData = {}) =>
    openNewOffer(trades, `${TRADES_NEW_PATH}?team=${team}&player=${player}`);
  /** Team 3's one player, whose card the offer comes from. */
  const WISSA = { ...JAMES, code: 1009, name: "Wissa" };
  const third = screenTeam("team-3" as never, "Team 3", [WISSA]);
  const ticked = () => screen.getByRole<HTMLInputElement>("checkbox", { name: tickLabel(WISSA.name) }).checked;

  it("opens with his owner chosen and him asked for, so only what you give is added", async () => {
    const app = fromCard("team-3", WISSA.code, { view: { ...quietTrades, teams: [...quietTrades.teams, third] } });
    const picker = await screen.findByRole<HTMLSelectElement>("combobox", { name: partnerLabel });
    expect(picker.value).toBe("team-3");
    expect(picker.disabled).toBe(false);
    expect(ticked()).toBe(true);
    await tick("Team 1", SAKA.name);
    await userEvent.click(screen.getByRole("button", { name: sendOfferWords }));
    expect(app.trades.offer).toHaveBeenCalledWith(league.leagueId, "team-3", { gives: [SAKA.code], gets: [WISSA.code], note: null });
  });

  it("chooses his owner but ticks nobody when he is held in a trade under review", async () => {
    const held = { ...third, players: [{ ...WISSA, held: true }] };
    fromCard("team-3", WISSA.code, { view: { ...quietTrades, teams: [...quietTrades.teams, held] } });
    expect((await screen.findByRole<HTMLSelectElement>("combobox", { name: partnerLabel })).value).toBe("team-3");
    expect(ticked()).toBe(false);
  });

  it("opens as a plain new offer when the team named can't be traded with", async () => {
    fromCard("team-gone", WISSA.code);
    expect((await screen.findByRole<HTMLSelectElement>("combobox", { name: partnerLabel })).value).toBe(THEIR_TEAM);
    expect(screen.getAllByRole<HTMLInputElement>("checkbox").every((box) => !box.checked)).toBe(true);
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
