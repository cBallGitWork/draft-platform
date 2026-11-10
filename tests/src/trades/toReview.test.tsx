// The Offers tab's To review group (#383; Craig, 10 Nov 2026): a trade the manager reviews sits at
// the top, its sides read as what each team gets, waiting on him until the review ends. Its panel
// has Block behind a confirm under a veto; under a vote, Against, then his own vote with Take back.
// A commissioner with no team sees the trades he reviews, and a Mail letter's link opens one.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TRADES_PATH } from "../../../src/frame/menu";
import {
  againstWords,
  blockQuestion,
  blockWords,
  blockYesWords,
  groupWords,
  noTeamWords,
  offersTableLabel,
  offerToYouTitle,
  takeBackWords,
  toReviewWords,
  tradeBetweenTitle,
  votedAgainstWords,
  whenWords,
  yourReviewWords,
} from "../../../src/trades/words";
import { commissioner, league, manager, openApp } from "../../support/src/shell.harness";
import { quietTrades, screenOffer, tradeToReview, type TradesData } from "../../support/src/trades.harness";

const ENDS = Date.parse("2026-11-11T09:40:00Z");
const openOffers = (trades: TradesData, path = TRADES_PATH, session = manager) => openApp(path, session, { trades });
const panel = (title: string) => screen.findByRole("region", { name: title });

describe("the To review group", () => {
  it("sits above the manager's own offers, the two teams' sides each read as what that team gets", async () => {
    openOffers({ view: { ...quietTrades, offers: [screenOffer()] }, reviews: [tradeToReview()] });
    const table = await screen.findByRole("table", { name: offersTableLabel });
    const rows = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.textContent);
    expect(rows[0]).toBe(toReviewWords);
    expect(rows[1]).toContain("Team 3 and Team 4");
    expect(rows[1]).toContain("Team 3 get FBJames");
    expect(rows[1]).toContain("Team 4 get CDMRice");
    expect(rows[1]).toContain("You");
    expect(rows[1]).toContain(whenWords(ENDS));
    expect(rows[2]).toBe(groupWords.toYou);
    expect(await panel(tradeBetweenTitle("Team 3", "Team 4"))).toBeTruthy();
  });

  it("gives way to one of his own offers when he picks it", async () => {
    openOffers({ view: { ...quietTrades, offers: [screenOffer()] }, reviews: [tradeToReview()] });
    await userEvent.click(await screen.findByRole("button", { name: "Team 2" }));
    expect(await panel(offerToYouTitle("Team 2"))).toBeTruthy();
    expect(screen.queryByRole("region", { name: tradeBetweenTitle("Team 3", "Team 4") })).toBeNull();
  });
});

describe("under a veto", () => {
  it("shows both sides, the note and the review's end, and blocks only once the confirm says so", async () => {
    const app = openOffers({ reviews: [tradeToReview({ note: "Need a 9." })] });
    const selected = await panel(tradeBetweenTitle("Team 3", "Team 4"));
    const text = selected.textContent ?? "";
    expect(text).toContain("“Need a 9.”");
    expect(text).toContain(yourReviewWords.block);
    expect(text).toContain(whenWords(ENDS));

    await userEvent.click(within(selected).getByRole("button", { name: blockWords }));
    expect(screen.getByText(blockQuestion("Team 3", "Team 4"))).toBeTruthy();
    expect(app.trades.block).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: blockYesWords }));
    expect(app.trades.block).toHaveBeenCalledWith(league.leagueId, "review-1");
  });

  it("a refusal says why", async () => {
    openOffers({ reviews: [tradeToReview()], refusal: "That trade isn't in review." });
    await userEvent.click(await screen.findByRole("button", { name: blockWords }));
    await userEvent.click(screen.getByRole("button", { name: blockYesWords }));
    expect((await screen.findByRole("alert")).textContent).toBe("That trade isn't in review.");
  });
});

describe("under a vote", () => {
  it("votes Against", async () => {
    const app = openOffers({ reviews: [tradeToReview({ yours: "against" })] });
    const selected = await panel(tradeBetweenTitle("Team 3", "Team 4"));
    expect(within(selected).queryByRole("button", { name: blockWords })).toBeNull();
    await userEvent.click(within(selected).getByRole("button", { name: againstWords }));
    expect(app.trades.against).toHaveBeenCalledWith(league.leagueId, "review-1");
  });

  it("once voted, shows only his own vote, and takes it back", async () => {
    const app = openOffers({ reviews: [tradeToReview({ yours: "takeBack" })] });
    const selected = await panel(tradeBetweenTitle("Team 3", "Team 4"));
    expect(selected.textContent).toContain(votedAgainstWords);
    expect(within(selected).queryByRole("button", { name: againstWords })).toBeNull();
    await userEvent.click(within(selected).getByRole("button", { name: takeBackWords }));
    expect(app.trades.takeBack).toHaveBeenCalledWith(league.leagueId, "review-1");
  });
});

describe("reaching one", () => {
  it("a Mail letter's link opens Trades with it selected", async () => {
    openOffers(
      { reviews: [tradeToReview(), tradeToReview({ offerId: "review-2" as never, fromTeamName: "Team 5", toTeamName: "Team 6" })] },
      `${TRADES_PATH}?offer=review-2`,
    );
    expect(await panel(tradeBetweenTitle("Team 5", "Team 6"))).toBeTruthy();
  });

  it("a commissioner with no team sees the trades he reviews, and asks nothing of a team's", async () => {
    const app = openOffers({ reviews: [tradeToReview()] }, TRADES_PATH, commissioner);
    expect(await panel(tradeBetweenTitle("Team 3", "Team 4"))).toBeTruthy();
    expect(app.trades.useTrades).not.toHaveBeenCalled();
  });

  it("with none to review, he is told he has no team", async () => {
    openOffers({}, TRADES_PATH, commissioner);
    expect(await screen.findByText(noTeamWords)).toBeTruthy();
  });
});
