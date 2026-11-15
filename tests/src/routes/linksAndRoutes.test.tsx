// The regression catalogue's screens-and-routes cases, part 2 (#2306), below the browser: Trades'
// New offer and Send offer, which need the fake server to hold the offer sent. Each test's name
// carries its case ID and the flow line it checks. The cases in a real browser are in
// tests/smoke/linksAndRoutes.spec.ts.

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { TRADES_NEW_PATH, TRADES_PATH } from "../../../src/frame/menu";
import { menuWords } from "../../../src/shared/words";
import { offersTableLabel, sendOfferWords, squadTableLabel, tickLabel } from "../../../src/trades/words";
import { manager, openApp } from "../../support/src/shell.harness";
import { MY_TEAM_NAME, THEIR_TEAM_NAME } from "../../support/src/teams.harness";
import { MY_TEAM, PALMER, quietTrades, SAKA, screenOffer, THEIR_TEAM } from "../../support/src/trades.harness";

const tick = async (team: string, name: string) =>
  userEvent.click(within(await screen.findByRole("table", { name: squadTableLabel(team) })).getByRole("checkbox", { name: tickLabel(name) }));

it("UI-095 (flow.md:121-122): from Offers, New offer opens /trades/new, and Send offer goes back to Offers with the offer listed", async () => {
  const app = openApp(TRADES_PATH, manager);
  await userEvent.click((await screen.findAllByRole("link", { name: menuWords.newOffer }))[0]!);
  expect(app.path()).toBe(TRADES_NEW_PATH);
  await tick(MY_TEAM_NAME, SAKA.name);
  await tick(THEIR_TEAM_NAME, PALMER.name);
  await userEvent.click(screen.getByRole("button", { name: sendOfferWords }));
  expect(app.path()).toBe(TRADES_PATH);

  // The server's answer once it holds the offer.
  const sent = screenOffer({ fromTeamId: MY_TEAM, fromTeamName: MY_TEAM_NAME, toTeamId: THEIR_TEAM, toTeamName: THEIR_TEAM_NAME, gives: [SAKA], gets: [PALMER] });
  app.trades.showView({ ...quietTrades, offers: [sent] });
  const rows = within(await screen.findByRole("table", { name: offersTableLabel })).getAllByRole("row");
  expect(rows.some(({ textContent }) => textContent?.includes(THEIR_TEAM_NAME) && textContent.includes(PALMER.name))).toBe(true);
});
