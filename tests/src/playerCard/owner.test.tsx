// Who holds a player, in his card's head (#2650; spec/12 S12.2): "Owned by" his team, "Released"
// with when the bids on him settle while he is on waivers, or "Free agent" for one nobody owns,
// never "Owned by Free agent". The rest of the head is playerCard.test.tsx's.

import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PlayerCard } from "../../../src/playerCard/seam";
import { ownedByWords, releasedWords } from "../../../src/playerCard/words";
import { freeAgentWords } from "../../../src/shared/words";
import { HELD, openCard, RICE, SAKA } from "../../support/src/playerCardScreen.harness";

const headOf = async (card: PlayerCard) => within(await screen.findByRole("region", { name: card.fullName }));

describe("who holds him", () => {
  it("S12.2 a team's player is owned by it", async () => {
    openCard(SAKA);
    const head = await headOf(SAKA);
    expect([head.getByText(ownedByWords), head.queryByText(freeAgentWords)]).toEqual([expect.anything(), null]);
  });

  it("S12.2 a free agent says Free agent, never owned by anybody", async () => {
    openCard(RICE);
    const head = await headOf(RICE);
    expect([head.getByText(freeAgentWords), head.queryByText(ownedByWords)]).toEqual([expect.anything(), null]);
  });

  it("S12.2 a released player says Released and when the bids on him settle, never a free agent", async () => {
    const firstRun = { at: Date.UTC(2026, 10, 19, 18), skippedIf: null };
    openCard(RICE, { ...HELD, released: new Map([[RICE.code, { firstRun }]]) });
    const head = await headOf(RICE);
    expect([head.getByText(releasedWords(firstRun)).textContent, head.queryByText(freeAgentWords), head.queryByText(ownedByWords)]).toEqual([
      expect.stringMatching(/^Released: bids settle \S/),
      null,
      null,
    ]);
  });

  it("S12.2 a released player with no run times says Released alone", async () => {
    openCard(RICE, { ...HELD, released: new Map([[RICE.code, { firstRun: null }]]) });
    expect((await headOf(RICE)).getByText("Released")).toBeTruthy();
  });
});
