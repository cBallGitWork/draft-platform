import { describe, expect, test } from "vitest";
import type { DeadlineRatings } from "../../../convex/lineup/autoSubs";
import { FIRST, STRIKER, STRIKERS_CELL, plays, subbed, withBench } from "../../support/convex/autoSubs.harness";

// An auto-sub's role (spec/05 Auto-subs; Craig, 1 Nov 2026): one coming on in his own area plays
// the role he had the most stars for at the deadline; one into the empty slot takes its role.

const NUMBER_TEN_SLOT = { area: "attackingMidfield", lane: "leftCentre" } as const;
/** At the deadline the sub was a 4-star shadow striker and a 2-star number 10. */
const SHADOW_AT_DEADLINE: DeadlineRatings = () => [
  { area: "attackingMidfield", role: "numberTen", stars: 2 },
  { area: "attackingMidfield", role: "attackingMidfieldShadowStriker", stars: 4 },
];

const starterOn = (result: ReturnType<typeof subbed>, playerCode: number) => result.lineup.starters.find((starter) => starter.playerCode === playerCode);

describe("a sub who comes on in his own area", () => {
  test("plays the role he had the most stars for there at the deadline", () => {
    // A winger never plays up front (spec/05 `S05.29`), so he comes on in his own area.
    const { lineup, positions } = withBench(["W"]);
    const result = subbed(lineup, positions, plays(lineup, [STRIKER]), undefined, SHADOW_AT_DEADLINE);

    expect(starterOn(result, FIRST)).toEqual({ playerCode: FIRST, ...NUMBER_TEN_SLOT, role: "attackingMidfieldShadowStriker" });
  });

  test("with no stars kept at the deadline, a gameweek locked before they were, plays the slot's first role", () => {
    const { lineup, positions } = withBench(["W"]);
    expect(starterOn(subbed(lineup, positions, plays(lineup, [STRIKER])), FIRST)).toEqual({ playerCode: FIRST, ...NUMBER_TEN_SLOT });
  });
});

// S05.29
test("a CAM into the striker's empty slot plays false 9, the one attack role he may take", () => {
  const { lineup: plain, positions } = withBench(["CAM"]);
  const lineup = { ...plain, starters: plain.starters.map((starter) => (starter.playerCode === STRIKER ? { ...starter, role: "targetMan" } : starter)) };

  const result = subbed(lineup, positions, plays(lineup, [STRIKER]));
  expect(result.substitutions).toMatchObject([{ on: FIRST, into: "theSlot" }]);
  expect(starterOn(result, FIRST)).toEqual({ playerCode: FIRST, ...STRIKERS_CELL, role: "falseNine" });
});

test("a sub into the empty slot takes its role, whatever his stars", () => {
  const { lineup: plain, positions } = withBench(["ST"]);
  const lineup = { ...plain, starters: plain.starters.map((starter) => (starter.playerCode === STRIKER ? { ...starter, role: "targetMan" } : starter)) };
  const poacher: DeadlineRatings = () => [{ area: "attack", role: "poacher", stars: 5 }];

  expect(starterOn(subbed(lineup, positions, plays(lineup, [STRIKER]), undefined, poacher), FIRST)).toEqual({ playerCode: FIRST, ...STRIKERS_CELL, role: "targetMan" });
});
