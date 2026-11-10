// Trades' Closed offers (#383; docs/design/approved/trades): below the open offers, the manager's
// offers that ended this season, each with who it was with, what he would have got and given, why it
// closed from his side, and when; Older shows the rest.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { TRADES_PATH } from "../../../src/frame/menu";
import { CLOSED_FIRST } from "../../../src/trades/ClosedOffers";
import {
  CLOSED_TITLE,
  closedTableLabel,
  closedWhyWords,
  dayWords,
  noClosedWords,
  olderWords,
  thisSeasonWords,
} from "../../../src/trades/words";
import { manager, openApp } from "../../support/src/shell.harness";
import {
  closedOffer,
  MY_TEAM,
  quietTrades,
  THEIR_TEAM,
} from "../../support/src/trades.harness";

const openWith = (...closed: ReturnType<typeof closedOffer>[]) =>
  openApp(TRADES_PATH, manager, { trades: { view: { ...quietTrades, closed } } });

describe("closed offers", () => {
  it("says so when none closed this season", async () => {
    openWith();
    const panel = await screen.findByRole("region", { name: new RegExp(CLOSED_TITLE) });
    expect(panel.textContent).toContain(thisSeasonWords);
    expect(panel.textContent).toContain(noClosedWords);
  });

  it("shows each from the manager's side: who with, what he gets and gives, why from his side, and when", async () => {
    openWith(
      closedOffer(),
      closedOffer({
        closedId: "closed-2" as Id<"closedTradeOffers">,
        fromTeamId: MY_TEAM,
        fromTeamName: "Team 1",
        toTeamId: THEIR_TEAM,
        toTeamName: "Team 2",
        why: "withdrawn",
      }),
      closedOffer({ closedId: "closed-3" as Id<"closedTradeOffers">, why: "blocked" }),
    );
    const table = await screen.findByRole("table", { name: closedTableLabel });
    const [rejected, withdrawn, blocked] = within(table).getAllByRole("row").slice(1);
    expect(within(rejected).getByRole("rowheader").textContent).toBe("Team 2");
    const cells = within(rejected).getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells[0]).toContain("Palmer");
    expect(cells[1]).toContain("Saka");
    expect(cells[2]).toBe(closedWhyWords("rejected", true));
    expect(cells[3]).toBe(dayWords(closedOffer().closedAt));
    expect(withdrawn.textContent).toContain(closedWhyWords("withdrawn", true));
    expect(within(withdrawn).getAllByRole("cell")[0].textContent).toContain("Saka");
    expect(blocked.textContent).toContain(closedWhyWords("blocked", false));
  });

  it("names the other team as the one that acted when it did", () => {
    expect(closedWhyWords("rejected", false)).toBe("They rejected it");
    expect(closedWhyWords("withdrawn", true)).toBe("You withdrew it");
  });

  it("shows the newest first few, and Older shows the rest", async () => {
    const many = Array.from({ length: CLOSED_FIRST + 2 }, (_, each) =>
      closedOffer({ closedId: `closed-${each}` as Id<"closedTradeOffers"> }),
    );
    openWith(...many);
    const table = await screen.findByRole("table", { name: closedTableLabel });
    expect(within(table).getAllByRole("row")).toHaveLength(CLOSED_FIRST + 1);
    await userEvent.click(screen.getByRole("button", { name: olderWords }));
    expect(within(table).getAllByRole("row")).toHaveLength(many.length + 1);
    expect(screen.queryByRole("button", { name: olderWords })).toBeNull();
  });
});
