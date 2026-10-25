// The player card's tests' fake seam (shell.harness.tsx hands it to the app): the cards it holds by
// player code, so a test sees what a card shows and what was asked for.

import { vi } from "vitest";
import type { PlayerCard, PlayerCardSeam } from "../../../src/playerCard/seam";

/** What the fake server holds: each player's card, or nothing yet while it loads. */
export type PlayerCardData = { cards?: readonly PlayerCard[]; loading?: boolean };

export function fakePlayerCard({ cards = [], loading = false }: PlayerCardData = {}) {
  return {
    usePlayerCard: vi.fn<PlayerCardSeam["usePlayerCard"]>((_leagueId, playerCode) =>
      loading ? undefined : (cards.find((card) => card.code === playerCode) ?? null),
    ),
  };
}
