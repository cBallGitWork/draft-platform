// Trades across the minute's turn (#1747): Trades is read at the screen's minute, so each minute
// asks again; the last answer stays up while the next loads, so a half-made offer, the selected
// offer and an open Reject confirm all survive the clock. The live seam's read, with Convex faked.

import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { MINUTE_MS } from "../../../convex/shared/time";
import { MY_TEAM_PATH } from "../../../src/frame/menu";
import { mainMenuLabel } from "../../../src/frame/words";
import { menuWords } from "../../../src/shared/words";
import { liveTrades } from "../../../src/trades/liveTrades";
import type { TradesView } from "../../../src/trades/seam";
import {
  noteLabel,
  offerToYouTitle,
  rejectQuestion,
  rejectWords,
  squadTableLabel,
  tickLabel,
  TRADES_TITLE,
} from "../../../src/trades/words";
import { answeredAtFirstMinute } from "../../support/src/convexReact.harness";
import { manager, openApp } from "../../support/src/shell.harness";
import { PALMER, quietTrades, SAKA, screenOffer } from "../../support/src/trades.harness";

const convex = vi.hoisted(() => ({ ofMyTeam: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "trades/tradeScreen:ofMyTeam": convex.ofMyTeam },
  }),
);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  convex.ofMyTeam.mockReset();
});
afterEach(() => vi.useRealTimers());

/** Trades reached from the menu and read through the live seam, the server answering `view` at the
 *  first minute and still loading at the next. Reached from the menu, not opened on, so the live
 *  read is in place before Trades first renders. */
async function openLive(view: TradesView) {
  convex.ofMyTeam.mockImplementation(answeredAtFirstMinute(view));
  const app = openApp(MY_TEAM_PATH, manager);
  app.trades.useTrades.mockImplementation(liveTrades.useTrades);
  await userEvent.click(
    within(await screen.findByRole("navigation", { name: mainMenuLabel })).getByRole("link", { name: TRADES_TITLE }),
  );
  await screen.findByRole("heading", { level: 1, name: TRADES_TITLE });
}

/** The clock moves on a minute, so Trades is asked again, at the next. */
function turnTheMinute() {
  act(() => vi.advanceTimersByTime(MINUTE_MS));
  expect(new Set(convex.ofMyTeam.mock.calls.map(([{ now }]) => now)).size).toBe(2);
}

const squad = (team: string) => screen.findByRole("table", { name: squadTableLabel(team) });
const tickOf = async (team: string, name: string) =>
  within(await squad(team)).getByRole("checkbox", { name: tickLabel(name) });

test("on New offer, the ticks and the note survive the minute's turn", async () => {
  await openLive(quietTrades);
  await userEvent.click(await screen.findByRole("link", { name: menuWords.newOffer }));
  await userEvent.click(await tickOf("Team 1", SAKA.name));
  await userEvent.click(await tickOf("Team 2", PALMER.name));
  await userEvent.type(screen.getByRole("textbox", { name: noteLabel }), "Fancy it?");

  turnTheMinute();
  expect(await tickOf("Team 1", SAKA.name)).toHaveProperty("checked", true);
  expect(await tickOf("Team 2", PALMER.name)).toHaveProperty("checked", true);
  expect(screen.getByRole("textbox", { name: noteLabel })).toHaveProperty("value", "Fancy it?");
});

test("on Offers, the selected offer and its open Reject confirm survive the minute's turn", async () => {
  const fromTeam3 = screenOffer({ offerId: "offer-2" as never, fromTeamId: "team-3" as never, fromTeamName: "Team 3" });
  await openLive({ ...quietTrades, offers: [screenOffer(), fromTeam3] });
  await userEvent.click(await screen.findByRole("button", { name: "Team 3" }));
  const selected = await screen.findByRole("region", { name: offerToYouTitle("Team 3") });
  await userEvent.click(within(selected).getByRole("button", { name: rejectWords }));
  expect(screen.getByText(rejectQuestion("Team 3"))).toBeTruthy();

  turnTheMinute();
  expect(screen.getByRole("region", { name: offerToYouTitle("Team 3") })).toBeTruthy();
  expect(screen.getByText(rejectQuestion("Team 3"))).toBeTruthy();
});
