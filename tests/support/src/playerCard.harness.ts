// The player card's tests' fake seam (shell.harness.tsx hands it to the app): the cards it holds by
// player code, so a test sees what a card shows and what was asked for, an override among it.

import { vi } from "vitest";
import type { PlayerCard, PlayerCardSeam } from "../../../src/playerCard/seam";
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
