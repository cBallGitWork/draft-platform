// Trades' Offers tab (#383; docs/design/approved/trades): reached from the menu; the manager's
// offers grouped To you, From you and In review; the selected one's panel with what he can do:
// Accept, Counter and Reject (behind a confirm) an offer to him, Withdraw his own, nothing once it
// is in review; a limit his squad would break warns, and trades shut say why.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  MY_TEAM_PATH,
  TRADES_NEW_PATH,
  TRADES_PATH,
} from "../../../src/frame/menu";
import { mainMenuLabel } from "../../../src/frame/words";
import { noFigureWords } from "../../../src/shared/words";
import {
  acceptWords,
  afterLastMatchWords,
  counterWords,
  groupWords,
  noOffersWords,
  offersTableLabel,
  offerToYouTitle,
  rejectQuestion,
  rejectWords,
  rejectYesWords,
  reviewerWords,
  shutWords,
  TRADES_TITLE,
  tradesLoadingWords,
  tradeWithTitle,
  whenWords,
  withdrawWords,
  yourOfferToTitle,
} from "../../../src/trades/words";
import { league, manager, openApp } from "../../support/src/shell.harness";
import {
  MY_TEAM,
  quietTrades,
  screenOffer,
  THEIR_TEAM,
  type TradesData,
} from "../../support/src/trades.harness";

const openOffers = (trades: TradesData = {}) =>
  openApp(TRADES_PATH, manager, { trades });
const withOffers = (
  ...offers: ReturnType<typeof screenOffer>[]
): TradesData => ({ view: { ...quietTrades, offers } });
const panel = (title: string) => screen.findByRole("region", { name: title });

describe("reaching it", () => {
  it("a manager opens it from the menu's Trades, for the league the app is in", async () => {
    const app = openApp(MY_TEAM_PATH, manager);
    await userEvent.click(
      within(
        await screen.findByRole("navigation", { name: mainMenuLabel }),
      ).getByRole("link", { name: TRADES_TITLE }),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: TRADES_TITLE }),
    ).toBeTruthy();
    expect(app.path()).toBe(TRADES_PATH);
    expect(app.trades.useTrades).toHaveBeenCalledWith(league.leagueId);
  });

  it("says so while it loads", async () => {
    openOffers({ loading: true });
    expect((await screen.findByRole("status")).textContent).toBe(
      tradesLoadingWords,
    );
  });

  it("says when nothing is offered", async () => {
    openOffers();
    expect(await screen.findByText(noOffersWords)).toBeTruthy();
  });
});

describe("the offers", () => {
  it("are grouped To you, From you and In review, the first selected", async () => {
    const mine = screenOffer({
      offerId: "offer-2" as never,
      fromTeamId: MY_TEAM,
      fromTeamName: "Team 1",
      toTeamId: THEIR_TEAM,
      toTeamName: "Team 2",
    });
    const inReview = screenOffer({
      offerId: "offer-3" as never,
      closes: null,
      reviewEndsAt: Date.parse("2026-11-11T09:40:00Z"),
    });
    openOffers(withOffers(inReview, mine, screenOffer()));
    const table = await screen.findByRole("table", { name: offersTableLabel });
    const rows = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.textContent);
    expect(rows[0]).toBe(groupWords.toYou);
    expect(rows[1]).toContain("Team 2");
    expect(rows[1]).toContain("You");
    expect(rows[2]).toBe(groupWords.fromYou);
    expect(rows[4]).toBe(groupWords.inReview);
    expect(rows[5]).toContain(reviewerWords.commissioner);
    expect(rows[5]).toContain(whenWords(Date.parse("2026-11-11T09:40:00Z")));
    expect(await panel(offerToYouTitle("Team 2"))).toBeTruthy();
  });

  it("selects another offer from its row", async () => {
    const mine = screenOffer({
      offerId: "offer-2" as never,
      fromTeamId: MY_TEAM,
      fromTeamName: "Team 1",
      toTeamId: THEIR_TEAM,
      toTeamName: "Team 3",
    });
    openOffers(withOffers(screenOffer(), mine));
    await userEvent.click(
      await screen.findByRole("button", { name: "Team 3" }),
    );
    const selected = await panel(yourOfferToTitle("Team 3"));
    expect(
      within(selected).getByRole("button", { name: withdrawWords }),
    ).toBeTruthy();
    expect(
      within(selected).queryByRole("button", { name: acceptWords }),
    ).toBeNull();
  });
});

describe("an offer to you", () => {
  it("shows both sides, the note, your squad after it, its review and when it closes", async () => {
    openOffers(withOffers(screenOffer({ note: "Fancy it?" })));
    const selected = await panel(offerToYouTitle("Team 2"));
    const text = selected.textContent ?? "";
    expect(text).toContain("Palmer");
    expect(text).toContain("Saka");
    expect(text).toContain("“Fancy it?”");
    expect(text).toContain("2 of 20 after it");
    expect(text).toContain("Commissioner veto: 24 hours once you accept");
    expect(text).toContain(
      `At the GW10 deadline, ${whenWords(Date.parse("2026-11-14T11:00:00Z"))}`,
    );
  });

  it("made in the trade deadline's gameweek, closes after its last match, in its row and its panel (#1492)", async () => {
    openOffers(withOffers(screenOffer({ closes: { gameweek: 20, at: null } })));
    const words = afterLastMatchWords(20);
    expect(words).toBe("After GW20's last match");
    const table = await screen.findByRole("table", { name: offersTableLabel });
    expect(within(table).getAllByRole("row")[2].textContent).toContain(words);
    expect((await panel(offerToYouTitle("Team 2"))).textContent).toContain(
      words,
    );
  });

  it("with no deadline left, closes as a greyed dash in its row and its panel alike (#1788)", async () => {
    openOffers(withOffers(screenOffer({ closes: null })));
    const table = await screen.findByRole("table", { name: offersTableLabel });
    const cells = within(within(table).getAllByRole("row")[2]).getAllByRole(
      "cell",
    );
    expect(cells[cells.length - 1].textContent).toBe(noFigureWords);
    const text = (await panel(offerToYouTitle("Team 2"))).textContent ?? "";
    expect(text).toContain(noFigureWords);
    expect(text).not.toContain("At the next deadline");
  });

  it("is accepted, and a refusal says why", async () => {
    const app = openOffers({
      ...withOffers(screenOffer()),
      refusal: "The league's trade deadline has passed.",
    });
    await userEvent.click(
      await screen.findByRole("button", { name: acceptWords }),
    );
    expect(app.trades.accept).toHaveBeenCalledWith(league.leagueId, "offer-1");
    expect((await screen.findByRole("alert")).textContent).toBe(
      "The league's trade deadline has passed.",
    );
  });

  it("is rejected only once the confirm says so", async () => {
    const app = openOffers(withOffers(screenOffer()));
    await userEvent.click(
      await screen.findByRole("button", { name: rejectWords }),
    );
    expect(screen.getByText(rejectQuestion("Team 2"))).toBeTruthy();
    expect(app.trades.reject).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: rejectYesWords }));
    expect(app.trades.reject).toHaveBeenCalledWith(league.leagueId, "offer-1");
  });

  it("is countered on New offer, filled with it", async () => {
    const app = openOffers(withOffers(screenOffer()));
    await userEvent.click(
      await screen.findByRole("link", { name: counterWords }),
    );
    expect(app.path()).toBe(TRADES_NEW_PATH);
    expect(app.search()).toContain("counter=offer-1");
  });

  it("is countered when it is a pick offer too (#1471)", async () => {
    openOffers(
      withOffers(
        screenOffer({
          gives: [],
          gets: [],
          picks: { gives: "Team 2's round 2 pick", gets: "Team 1's round 3 pick" },
          pickTerms: { gives: { round: 2, teamId: THEIR_TEAM }, gets: { round: 3, teamId: MY_TEAM } },
        }),
      ),
    );
    expect(await screen.findByRole("link", { name: counterWords })).toBeTruthy();
  });

  it("warns of a limit it would push your squad past", async () => {
    openOffers(
      withOffers(
        screenOffer({
          warnings: [{ kind: "overMaximum", players: 21, maximum: 20 }],
        }),
      ),
    );
    expect((await panel(offerToYouTitle("Team 2"))).textContent).toContain(
      "After it: 21 players, over the league's most of 20.",
    );
    expect(screen.getByRole("button", { name: acceptWords })).toBeTruthy();
  });
});

describe("a trade in review", () => {
  it("shows who reviews it and until when, with nothing to do", async () => {
    openOffers(
      withOffers(
        screenOffer({
          closes: null,
          reviewEndsAt: Date.parse("2026-11-11T09:40:00Z"),
          reviewer: "vote",
        }),
      ),
    );
    const selected = await panel(tradeWithTitle("Team 2"));
    expect(selected.textContent).toContain(reviewerWords.vote);
    expect(within(selected).queryAllByRole("button")).toEqual([]);
  });
});

describe("when trades are shut", () => {
  it("says why, and offers no Accept or Counter", async () => {
    openOffers({
      view: { ...quietTrades, shut: "tradeDeadline", offers: [screenOffer()] },
    });
    expect(await screen.findByText(shutWords.tradeDeadline)).toBeTruthy();
    expect(screen.queryByRole("button", { name: acceptWords })).toBeNull();
    expect(screen.queryByRole("link", { name: counterWords })).toBeNull();
    expect(screen.getByRole("button", { name: rejectWords })).toBeTruthy();
  });
});
