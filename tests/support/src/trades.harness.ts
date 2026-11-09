// Trades' tests' fake seam (shell.harness.tsx hands it to the app): the manager's Team 1, Team 2
// to trade with, nothing offered unless a test says.

import { vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type {
  ScreenOffer,
  ScreenTeam,
  TradedPlayer,
  TradeChanges,
  TradesSeam,
  TradesView,
} from "../../../src/trades/seam";

export const ARSENAL = { code: 3, name: "Arsenal", shortName: "ARS" };
export const CHELSEA = { code: 8, name: "Chelsea", shortName: "CHE" };

export const SAKA: TradedPlayer = {
  code: 1001,
  name: "Saka",
  position: "W",
  club: ARSENAL,
};
export const RICE: TradedPlayer = {
  code: 1002,
  name: "Rice",
  position: "CDM",
  club: ARSENAL,
};
export const PALMER: TradedPlayer = {
  code: 1003,
  name: "Palmer",
  position: "CAM",
  club: CHELSEA,
};
export const JAMES: TradedPlayer = {
  code: 1004,
  name: "James",
  position: "FB",
  club: CHELSEA,
};

export const MY_TEAM = "team-1" as Id<"teams">;
export const THEIR_TEAM = "team-2" as Id<"teams">;
export const DEADLINE = Date.parse("2026-11-14T11:00:00Z");

export const screenTeam = (
  teamId: Id<"teams">,
  teamName: string,
  players: readonly TradedPlayer[],
  rest: Partial<ScreenTeam> = {},
): ScreenTeam => ({
  teamId,
  teamName,
  onAutoTeam: false,
  players: players.map((player) => ({ ...player, held: false })),
  picks: [],
  ...rest,
});

/** An offer from Team 2 to Team 1, Palmer for Saka, open until gameweek 10's deadline, unless `rest` says. */
export const screenOffer = (rest: Partial<ScreenOffer> = {}): ScreenOffer => ({
  offerId: "offer-1" as Id<"tradeOffers">,
  fromTeamId: THEIR_TEAM,
  fromTeamName: "Team 2",
  toTeamId: MY_TEAM,
  toTeamName: "Team 1",
  gives: [PALMER],
  gets: [SAKA],
  picks: null,
  note: null,
  madeAt: Date.parse("2026-11-08T16:40:00Z"),
  closes: { gameweek: 10, at: DEADLINE },
  reviewer: "commissioner",
  reviewEndsAt: null,
  warnings: [],
  ...rest,
});

/** Team 1 holding Saka and Rice, Team 2 Palmer and James, a commissioner veto, nothing offered. */
export const quietTrades: TradesView = {
  myTeamId: MY_TEAM,
  shut: null,
  squadMaximum: 20,
  teams: [
    screenTeam(MY_TEAM, "Team 1", [SAKA, RICE]),
    screenTeam(THEIR_TEAM, "Team 2", [PALMER, JAMES]),
  ],
  offers: [],
};

/** What the fake server holds: the Trades view, or nothing yet while it loads; and the refusal each
 *  change answers with (null: made). */
export type TradesData = {
  view?: TradesView;
  loading?: boolean;
  refusal?: string | null;
};

export function fakeTrades({
  view = quietTrades,
  loading = false,
  refusal = null,
}: TradesData = {}) {
  const changes = {
    offer: vi.fn<TradeChanges["offer"]>(async () => refusal),
    counter: vi.fn<TradeChanges["counter"]>(async () => refusal),
    accept: vi.fn<TradeChanges["accept"]>(async () => refusal),
    reject: vi.fn<TradeChanges["reject"]>(async () => refusal),
    withdraw: vi.fn<TradeChanges["withdraw"]>(async () => refusal),
  };
  return {
    ...changes,
    useTrades: vi.fn<TradesSeam["useTrades"]>(() =>
      loading ? undefined : view,
    ),
    useTradeChanges: vi.fn<TradesSeam["useTradeChanges"]>(() => changes),
  };
}
