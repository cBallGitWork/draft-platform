// Trades across the clock's turn (#1747, #2008): Trades is asked for by the hour and judged at the
// screen's minute, so a minute's turn asks nothing new; at the hour's turn the last answer stays up
// while the next loads, so a half-made offer, the selected offer and an open Reject confirm all
// survive the clock. The live seam's read, with Convex faked.

import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { HOUR_MS, MINUTE_MS, SECOND_MS } from "../../../convex/shared/time";
import type { HeldTrades } from "../../../convex/trades/tradeScreen";
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
import { manager, openApp } from "../../support/src/shell.harness";
import { heldTrades, PALMER, quietTrades, SAKA, screenOffer } from "../../support/src/trades.harness";

const convex = vi.hoisted(() => ({ ofMyTeam: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "trades/tradeScreen:ofMyTeam": convex.ofMyTeam },
  }),
);

/** Just past an hour's start, so the real time the test takes (the fake clock advances with it)
 *  never carries it over into another hour (#2160). */
const START = Date.parse("2026-11-14T12:00:00Z") + SECOND_MS;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: START });
  convex.ofMyTeam.mockReset();
});
afterEach(() => vi.useRealTimers());

/** The hours Trades has been asked for. */
const hoursAsked = () => new Set(convex.ofMyTeam.mock.calls.map(([{ hour }]) => hour));

/** Trades reached from the menu and read through the live seam, the server answering `view` for
 *  the first hour and still loading for the next. Reached from the menu, not opened on, so the
 *  live read is in place before Trades first renders. */
async function openLive(view: TradesView, held: HeldTrades = heldTrades(view)) {
  let first: number | undefined;
  convex.ofMyTeam.mockImplementation(({ hour }: { hour: number }) => {
    first ??= hour;
    return hour === first ? held : undefined;
  });
  const app = openApp(MY_TEAM_PATH, manager);
  app.trades.useTrades.mockImplementation(liveTrades.useTrades);
  await userEvent.click(
    within(await screen.findByRole("navigation", { name: mainMenuLabel })).getByRole("link", { name: TRADES_TITLE }),
  );
  await screen.findByRole("heading", { level: 1, name: TRADES_TITLE });
}

/** The clock moves on an hour, so Trades is asked again, for the next. */
function turnTheHour() {
  act(() => vi.advanceTimersByTime(HOUR_MS));
  expect(hoursAsked().size).toBe(2);
}

const squad = (team: string) => screen.findByRole("table", { name: squadTableLabel(team) });
const tickOf = async (team: string, name: string) =>
  within(await squad(team)).getByRole("checkbox", { name: tickLabel(name) });

test("a minute's turn asks Trades for the same hour, so the server isn't asked again (#2008)", async () => {
  await openLive(quietTrades);
  act(() => vi.advanceTimersByTime(MINUTE_MS));
  expect(convex.ofMyTeam.mock.calls.length).toBeGreaterThan(1);
  expect(hoursAsked()).toEqual(new Set([START - SECOND_MS]));
});

test("on New offer, the ticks and the note survive the hour's turn", async () => {
  await openLive(quietTrades);
  await userEvent.click(await screen.findByRole("link", { name: menuWords.newOffer }));
  await userEvent.click(await tickOf("Team 1", SAKA.name));
  await userEvent.click(await tickOf("Team 2", PALMER.name));
  await userEvent.type(screen.getByRole("textbox", { name: noteLabel }), "Fancy it?");

  turnTheHour();
  expect(await tickOf("Team 1", SAKA.name)).toHaveProperty("checked", true);
  expect(await tickOf("Team 2", PALMER.name)).toHaveProperty("checked", true);
  expect(screen.getByRole("textbox", { name: noteLabel })).toHaveProperty("value", "Fancy it?");
});

test("on Offers, the selected offer and its open Reject confirm survive the hour's turn", async () => {
  const fromTeam3 = screenOffer({ offerId: "offer-2" as never, fromTeamId: "team-3" as never, fromTeamName: "Team 3" });
  await openLive({ ...quietTrades, offers: [screenOffer(), fromTeam3] });
  await userEvent.click(await screen.findByRole("button", { name: "Team 3" }));
  const selected = await screen.findByRole("region", { name: offerToYouTitle("Team 3") });
  await userEvent.click(within(selected).getByRole("button", { name: rejectWords }));
  expect(screen.getByText(rejectQuestion("Team 3"))).toBeTruthy();

  turnTheHour();
  expect(screen.getByRole("region", { name: offerToYouTitle("Team 3") })).toBeTruthy();
  expect(screen.getByText(rejectQuestion("Team 3"))).toBeTruthy();
});

test("a deadline passing in the next hour while its answer still loads leaves Trades up, a half-made offer with it (S08.9)", async () => {
  // Gameweek 12's deadline half an hour into the next hour: the held answer, this hour's, has no
  // phase for it begun, since no minute of this hour sees it begin.
  const deadline = START - SECOND_MS + HOUR_MS + 30 * MINUTE_MS;
  await openLive(quietTrades, { ...heldTrades(quietTrades), gameweeks: [{ gameweek: 12, deadline }] });
  await userEvent.click(await screen.findByRole("link", { name: menuWords.newOffer }));
  await userEvent.click(await tickOf("Team 1", SAKA.name));

  turnTheHour();
  act(() => vi.advanceTimersByTime(31 * MINUTE_MS));
  expect(await tickOf("Team 1", SAKA.name)).toHaveProperty("checked", true);
});
