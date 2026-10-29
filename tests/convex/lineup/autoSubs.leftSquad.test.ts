// A starter who left the squad (spec/05, Auto-subs: "A starter's slot left empty because he left
// the squad (dropped, traded or claimed away) is filled from the bench the same way, as if he
// hadn't played"; #597). The lineup arrives without him, and his slot as `vacated`.

import { describe, expect, test } from "vitest";
import { autoSubs } from "../../../convex/lineup/autoSubs";
import { STARTER_COUNT, type Lineup, type Placement } from "../../../convex/lineup/lineup";
import { openLimits } from "../../support/convex/lineup.harness";
import {
  KEEPER,
  LEFT_BACK,
  STRIKER,
  FIRST,
  SECOND,
  STRIKERS_CELL,
  withBench,
  plays,
  strikerReplacedBy,
} from "../../support/convex/autoSubs.harness";

/** The lineup as it is read once `playerCode` has left the squad: without him, his slot vacated. */
function leftSquad(lineup: Lineup, playerCode: number): { held: Lineup; vacated: Placement[] } {
  return {
    held: { ...lineup, starters: lineup.starters.filter((starter) => starter.playerCode !== playerCode) },
    vacated: lineup.starters.filter((starter) => starter.playerCode === playerCode),
  };
}

describe("a slot left empty by a starter who left the squad", () => {
  test("is filled by the bench's first who can play its area, who takes the slot", () => {
    const { lineup, positions } = withBench(["CB"], ["ST"]);
    const { held, vacated } = leftSquad(lineup, STRIKER);
    const result = autoSubs(held, positions, plays(held, []), openLimits(), vacated);

    expect(result.substitutions).toEqual([strikerReplacedBy(SECOND)]);
    expect(result.unfilled).toEqual([]);
    expect(result.lineup.starters).toContainEqual({ playerCode: SECOND, ...STRIKERS_CELL });
    expect(result.lineup.starters).toHaveLength(STARTER_COUNT);
    // He is no one's to bench: he left.
    expect(result.lineup.bench).toEqual([FIRST]);
    expect(result.carriedProblems).toEqual([]);
  });

  test("with no one who can play it, the first who keeps the limits legal comes on in his own area", () => {
    const { lineup, positions } = withBench(["CB"]);
    const { held, vacated } = leftSquad(lineup, STRIKER);
    const result = autoSubs(held, positions, plays(held, []), openLimits(), vacated);

    expect(result.substitutions).toEqual([{ off: STRIKER, on: FIRST, area: "defence", lane: "centre", into: "hisOwnArea" }]);
    expect(result.lineup.bench).toEqual([]);
  });

  test("a goalkeeper's only by a goalkeeper", () => {
    const { lineup, positions } = withBench(["CB"], ["GK"]);
    const { held, vacated } = leftSquad(lineup, KEEPER);
    const result = autoSubs(held, positions, plays(held, []), openLimits(), vacated);
    expect(result.substitutions.map(({ off, on }) => [off, on])).toEqual([[KEEPER, SECOND]]);

    const outfieldOnly = withBench(["CB"]);
    const keeperless = leftSquad(outfieldOnly.lineup, KEEPER);
    const none = autoSubs(keeperless.held, outfieldOnly.positions, plays(keeperless.held, []), openLimits(), keeperless.vacated);
    expect(none.substitutions).toEqual([]);
    expect(none.unfilled).toEqual([KEEPER]);
  });

  test("with no legal sub, no one comes on and the slot scores nothing, as if he hadn't played", () => {
    // A midfielder can't play up front, and a fifth in midfield breaks its maximum.
    const fourInMidfield = openLimits({ midfield: { minimum: 0, maximum: 4 } });
    const { lineup, positions } = withBench(["CM"]);
    const { held, vacated } = leftSquad(lineup, STRIKER);
    const result = autoSubs(held, positions, plays(held, []), fourInMidfield, vacated);

    expect(result.substitutions).toEqual([]);
    expect(result.unfilled).toEqual([STRIKER]);
    expect(result.lineup).toEqual(held);
    expect(result.carriedProblems).toEqual([{ kind: "wrongStarterCount", starterCount: STARTER_COUNT - 1 }]);
  });

  test("counts as standing when the limits are weighed: a midfielder won't leave the back three for a minimum of four", () => {
    const backFour = openLimits({ defence: { minimum: 4, maximum: 5 } });
    const { lineup, positions } = withBench(["CM"]);
    const { held, vacated } = leftSquad(lineup, LEFT_BACK);
    const result = autoSubs(held, positions, plays(held, []), backFour, vacated);

    expect(result.unfilled).toEqual([LEFT_BACK]);
  });

  test("is filled back to front along with the starters who didn't play", () => {
    const { lineup, positions } = withBench(["ST"], ["CB"]);
    const { held, vacated } = leftSquad(lineup, LEFT_BACK);
    const result = autoSubs(held, positions, plays(held, [STRIKER]), openLimits(), vacated);

    expect(result.substitutions.map(({ off, on }) => [off, on])).toEqual([
      [LEFT_BACK, SECOND],
      [STRIKER, FIRST],
    ]);
    expect(result.lineup.bench).toEqual([STRIKER]);
  });

  test("is data gone wrong if someone still stands in it, or he is still in the lineup", () => {
    const { lineup, positions } = withBench(["ST"]);
    const { held, vacated } = leftSquad(lineup, STRIKER);
    // Vacated, yet the striker still stands in it; vacated by a man still on the bench.
    expect(() => autoSubs(lineup, positions, plays(lineup, []), openLimits(), vacated)).toThrow(/cellShared/);
    expect(() => autoSubs(held, positions, plays(held, []), openLimits(), [{ ...vacated[0], playerCode: FIRST }])).toThrow(/playerTwice/);
  });
});
