// The player card's tests' fake seam (shell.harness.tsx hands it to the app): the cards it holds by
// player code, so a test sees what a card shows and what was asked for, an override among it.

import { within } from "@testing-library/react";
import { vi } from "vitest";
import type { PlayedMatch, PlayerCard, PlayerCardSeam } from "../../../src/playerCard/seam";
import { breakdownLabel } from "../../../src/playerCard/words";
import { ARSENAL, COVENTRY } from "../convex/footballRows.harness";
import { fakeShortlist, type ShortlistData } from "./shortlist.harness";

/** What the fake server holds: each player's card, or nothing yet while it loads. */
export type PlayerCardData = {
  cards?: readonly PlayerCard[];
  loading?: boolean;
  shortlist?: ShortlistData;
  /** What the server says to an override: null when it saves it. */
  overrideRefusal?: string | null;
};

export function fakePlayerCard({ cards = [], loading = false, shortlist, overrideRefusal = null }: PlayerCardData = {}) {
  const override = vi.fn<ReturnType<PlayerCardSeam["useOverride"]>>(() => Promise.resolve(overrideRefusal));
  return {
    override,
    useOverride: () => override,
    ...fakeShortlist(shortlist),
    usePlayerCard: vi.fn<PlayerCardSeam["usePlayerCard"]>((_leagueId, playerCode) =>
      loading ? undefined : (cards.find((card) => card.code === playerCode) ?? null),
    ),
  };
}

// The cards the screen's tests open: Saka, at two positions, and Rice, with no matches.

export type Category = Extract<PlayedMatch["points"][number]["categories"][number], { points: number }>;
export type Why = Category["why"];
/** A per-action rule's why, the same for all: `actions` at `each` points. */
export const perAction = (actions: number, each: number): Why => ({ actions, value: { shape: "perAction", points: each }, pricedBy: { by: "all" }, cut: null });
export const category = (stat: string, name: string, points: number, why: Why = perAction(1, points)): Category => ({ stat, name, points, why });
export const atPosition = (position: "CAM" | "W", each: number): Why => ({ ...perAction(1, each), pricedBy: { by: "position", position } });
export const NINETY_MINUTES: Why = { actions: 90, value: { shape: "bands", earned: [{ atLeast: 60, points: 2 }] }, pricedBy: { by: "all" }, cut: null };
export const CATEGORIES = [
  category("goals_scored", "Goals scored", 5),
  category("assists", "Assists", 4, atPosition("W", 4)),
  category("minutes", "Minutes", 2, NINETY_MINUTES),
  category("yellow_cards", "Yellow cards", 0, perAction(0, -1)),
];
/** The breakdown's lines under the match of `gameweek`. */
export const breakdownLines = (season: ReturnType<typeof within>, gameweek: number) =>
  within(season.getByLabelText(breakdownLabel(gameweek)))
    .getAllByRole("listitem")
    .map((line) => line.textContent);
export const PRICED: PlayedMatch = {
  fixtureCode: 1,
  gameweek: 2,
  kickoff: Date.parse("2026-08-29T14:00:00Z"),
  home: ARSENAL,
  away: COVENTRY,
  minutes: 90,
  // At CAM, where his assist is worth one more, then at W: back to front, as pricedAt.
  points: [
    { position: "CAM", total: 12, categories: CATEGORIES.map((each) => (each.stat === "assists" ? category("assists", "Assists", 5, atPosition("CAM", 5)) : each)) },
    { position: "W", total: 11, categories: CATEGORIES },
  ],
  version: "26_27.2",
  override: null,
  provisional: false,
};
export const NOT_ARRIVED: PlayedMatch = {
  ...PRICED,
  fixtureCode: 2,
  gameweek: 3,
  minutes: null,
  points: PRICED.points.map((each) => ({ ...each, total: null, categories: each.categories.map((one) => ({ ...one, points: null })) })),
};
/** PRICED with only the winger's price, for a card priced at one position. */
export const AT_W: PlayedMatch = { ...PRICED, points: [PRICED.points[1]] };
export const SAKA: PlayerCard = {
  code: 1001,
  name: "Saka",
  fullName: "Bukayo Saka",
  club: ARSENAL,
  gone: false,
  positions: ["W", "CAM"],
  pricedAt: ["CAM", "W"],
  ownerTeamName: "Saka Potatoes",
  news: "Hamstring injury - 75% chance of playing",
  chanceOfPlaying: 75,
  matches: [NOT_ARRIVED, PRICED],
  nextFixtures: [{ fixtureCode: 9, gameweek: 10, kickoff: Date.parse("2026-11-07T15:00:00Z"), home: COVENTRY, away: ARSENAL }],
};
/** Saka priced at one position, so with no switch. */
export const AT_ONE: PlayerCard = { ...SAKA, pricedAt: ["W"] };
export const RICE: PlayerCard = { ...SAKA, code: 1002, name: "Rice", fullName: "Declan Rice", ownerTeamName: null, news: null, chanceOfPlaying: null, matches: [], nextFixtures: [] };
export const HELD: PlayerCardData = { cards: [SAKA, RICE] };
