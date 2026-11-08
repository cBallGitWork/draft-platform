// The player card's tests' fake seam (shell.harness.tsx hands it to the app): the cards it holds by
// player code, so a test sees what a card shows and what was asked for, an override among it.

import { vi } from "vitest";
import type { CardAction, PlayerCard, PlayerCardSeam, WaiverChanges } from "../../../src/playerCard/seam";
import { fakeScouts, type ScoutsData } from "./scouts.harness";
import { fakeShortlist, type ShortlistData } from "./shortlist.harness";

/** What the fake server holds: each player's card, or nothing yet while it loads. */
export type PlayerCardData = {
  cards?: readonly PlayerCard[];
  loading?: boolean;
  shortlist?: ShortlistData;
  scouts?: ScoutsData;
  /** What the server says to an override, or to its removal: null when it makes it. */
  overrideRefusal?: string | null;
  /** The card's waiver action on each player by code; none for a player not named. */
  actions?: ReadonlyMap<number, CardAction>;
  /** What the server says to a drop, a claim or a pickup: null when it makes it. */
  waiverRefusal?: string | null;
};

export function fakePlayerCard({ cards = [], loading = false, shortlist, scouts, overrideRefusal = null, actions = new Map(), waiverRefusal = null }: PlayerCardData = {}) {
  const override = vi.fn<ReturnType<PlayerCardSeam["useOverride"]>>(() => Promise.resolve(overrideRefusal));
  const answer = () => Promise.resolve(waiverRefusal);
  const waiverChanges = { drop: vi.fn<WaiverChanges["drop"]>(answer), claim: vi.fn<WaiverChanges["claim"]>(answer), pickUp: vi.fn<WaiverChanges["pickUp"]>(answer) };
  const removeOverride = vi.fn<ReturnType<PlayerCardSeam["useRemoveOverride"]>>(() => Promise.resolve(overrideRefusal));
  return {
    override,
    useOverride: () => override,
    removeOverride,
    useRemoveOverride: () => removeOverride,
    waiverChanges,
    useWaiverChanges: () => waiverChanges,
    useCardAction: (_leagueId: unknown, playerCode: number): CardAction => actions.get(playerCode) ?? { kind: "none" },
    ...fakeShortlist(shortlist),
    ...fakeScouts(scouts),
    usePlayerCard: vi.fn<PlayerCardSeam["usePlayerCard"]>((_leagueId, playerCode) =>
      loading ? undefined : (cards.find((card) => card.code === playerCode) ?? null),
    ),
  };
}
