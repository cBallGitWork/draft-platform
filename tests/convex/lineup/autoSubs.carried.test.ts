// Auto-subs on a lineup that isn't clean: data gone wrong is thrown; what a saved lineup can
// carry (an empty cell, limits a later rules change broke) is worked round and handed back.

import { describe, expect, test } from "vitest";
import { autoSubs } from "../../../convex/lineup/autoSubs";
import { openLimits, withPositions } from "../../support/convex/lineup.harness";
import {
  startersPositions,
  LEFT_BACK,
  STRIKER,
  OTHER_STRIKER,
  FIRST,
  SECOND,
  withBench,
  plays,
  untouched,
  strikerReplacedBy,
} from "../../support/convex/autoSubs.harness";

describe("what auto-subs refuse", () => {
  test("a player whose play isn't known", () => {
    const { lineup, positions } = withBench(["ST"]);
    const played = plays(lineup, []);
    played.delete(FIRST);

    expect(() => autoSubs(lineup, positions, played, openLimits())).toThrow(`whether player ${FIRST} played`);
  });

  test("a sub whose positions aren't known", () => {
    const { lineup } = withBench(["ST"]);

    expect(() => autoSubs(lineup, startersPositions, plays(lineup, []), openLimits())).toThrow(`player ${FIRST}'s positions`);
  });

  test("a lineup whose data has gone wrong: twelve starters, or one player twice", () => {
    const { lineup, positions } = withBench(["ST"]);
    const twelveMen = { ...lineup, starters: [...lineup.starters, { playerCode: FIRST, area: "attack", lane: "centre" }] };
    const twiceOver = { ...lineup, bench: [STRIKER] };

    expect(() => autoSubs(twelveMen, positions, plays(twelveMen, []), openLimits())).toThrow(/wrongStarterCount/);
    expect(() => autoSubs(twiceOver, startersPositions, plays(twiceOver, []), openLimits())).toThrow(/playerTwice/);
  });

  test("but not a starter who lost a position after he was placed: he stays, and the subs around him still come on", () => {
    const { lineup, positions } = withBench(["ST"]);
    const strikerNowAMidfielder = withPositions(positions, OTHER_STRIKER, ["CM"]);
    const result = autoSubs(lineup, strikerNowAMidfielder, plays(lineup, [STRIKER]), openLimits());

    expect(result.substitutions).toEqual([strikerReplacedBy(FIRST)]);
  });
});

describe("a saved lineup that can't quite stand", () => {
  test("with a cell left empty by a player who left the squad, the others are still subbed and the cell stays empty", () => {
    // The centre back first on the bench doesn't fill the empty cell at the back.
    const { lineup, positions } = withBench(["CB"], ["ST"]);
    const tenMen = { ...lineup, starters: lineup.starters.filter((starter) => starter.playerCode !== LEFT_BACK) };
    const result = autoSubs(tenMen, positions, plays(tenMen, [STRIKER]), openLimits());

    expect(result.substitutions).toEqual([strikerReplacedBy(SECOND)]);
    expect(result.lineup.starters).toHaveLength(tenMen.starters.length);
    expect(result.carriedProblems).toEqual([{ kind: "wrongStarterCount", starterCount: tenMen.starters.length }]);
  });

  // A later rules change asks for a back five; the saved 4-4-2 has four.
  const backFive = openLimits({ defence: { minimum: 5, maximum: 5 } });
  const shortAtTheBack = { kind: "belowMinimum", area: "defence", starterCount: 4, minimum: 5 };

  test("broken by a later rules change, it is still subbed, and the problem is handed back", () => {
    const { lineup, positions } = withBench(["ST"]);
    const result = autoSubs(lineup, positions, plays(lineup, [STRIKER]), backFive);

    expect(result.substitutions).toEqual([strikerReplacedBy(FIRST)]);
    expect(result.carriedProblems).toEqual([shortAtTheBack]);
  });

  test("no sub makes it worse: a midfielder won't leave the back three for a back five", () => {
    const { lineup, positions } = withBench(["CM"]);
    const result = autoSubs(lineup, positions, plays(lineup, [LEFT_BACK]), backFive);

    expect(result).toEqual({ ...untouched(lineup, [LEFT_BACK]), carriedProblems: [shortAtTheBack] });
  });

  test("but a sub may make it better: a centre back fills the fifth place at the back", () => {
    const { lineup, positions } = withBench(["CB"]);
    const result = autoSubs(lineup, positions, plays(lineup, [STRIKER]), backFive);

    expect(result.substitutions).toEqual([
      { off: STRIKER, on: FIRST, area: "defence", lane: "centre", into: "hisOwnArea" },
    ]);
    expect(result.carriedProblems).toEqual([]);
  });
});
