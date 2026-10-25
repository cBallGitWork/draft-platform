import { describe, expect, test } from "vitest";
import { autoSubs, gameweekPlay, type GameweekPlay, type PlayerMatch } from "../../../convex/lineup/autoSubs";
import { lineupProblems, type Lineup, type LineupRules, type PlayerPositions } from "../../../convex/lineup/lineup";
import type { Position } from "../../../convex/positions/positionTables";
import { FIRST_SUB, filledLineup, openLimits, presetNamed, withPositions } from "../../support/convex/lineup.harness";

// 4-4-2, starters 1 to 11 back to front and left to right: 1 the keeper, 2–5 the back four, 6–9
// the midfield four, 10 and 11 the strikers. The bench runs from 101, as long as each test needs.
const { lineup: fourFourTwo, positions: startersPositions } = filledLineup(presetNamed("4-4-2"));
const KEEPER = 1;
const LEFT_BACK = 2;
const LEFT_CENTRE_BACK = 3;
const LEFT_MIDFIELDER = 6;
const STRIKER = 10;
const OTHER_STRIKER = 11;
const [FIRST, SECOND, THIRD, FOURTH] = [0, 1, 2, 3].map((index) => FIRST_SUB + index);

/** The 4-4-2 with a bench of one player per label list, first to last, and everyone's positions. */
function withBench(...benchPositions: Position[][]): { lineup: Lineup; positions: PlayerPositions } {
  const lineup = { ...fourFourTwo, bench: fourFourTwo.bench.slice(0, benchPositions.length) };
  const positions = benchPositions.reduce<PlayerPositions>(
    (soFar, labels, index) => withPositions(soFar, lineup.bench[index], labels),
    startersPositions,
  );
  return { lineup, positions };
}

/** Everyone in the lineup played, but `absent` didn't and `overrides` say otherwise. */
function plays(lineup: Lineup, absent: number[], overrides: [number, GameweekPlay][] = []) {
  const everyone = [...lineup.starters.map((starter) => starter.playerCode), ...lineup.bench];
  const played = new Map<number, GameweekPlay>(everyone.map((playerCode) => [playerCode, "played"]));
  for (const playerCode of absent) played.set(playerCode, "didNotPlay");
  for (const [playerCode, play] of overrides) played.set(playerCode, play);
  return played;
}

/** Auto-subs, checked to leave a lineup that may stand. */
function subbed(
  lineup: Lineup,
  positions: PlayerPositions,
  played: ReadonlyMap<number, GameweekPlay>,
  rules: LineupRules = openLimits(),
) {
  const result = autoSubs(lineup, positions, played, rules);
  expect(lineupProblems(result.lineup, positions, rules)).toEqual([]);
  return result;
}

/** What auto-subs give when they change nothing: `unfilled` starters' slots score nothing. */
const untouched = (lineup: Lineup, unfilled: number[] = []) => ({ substitutions: [], unfilled, lineup });

const STRIKERS_CELL = { area: "attack", lane: "leftCentre" } as const;
const strikerReplacedBy = (on: number) => ({ off: STRIKER, on, ...STRIKERS_CELL, into: "theSlot" });

describe("a starter who didn't play is replaced", () => {
  test("by the bench's first who can play his slot, and sits where that sub sat", () => {
    const { lineup, positions } = withBench(["ST"]);
    const result = subbed(lineup, positions, plays(lineup, [STRIKER]));

    expect(result.substitutions).toEqual([strikerReplacedBy(FIRST)]);
    expect(result.unfilled).toEqual([]);
    expect(result.lineup.starters).toContainEqual({ playerCode: FIRST, ...STRIKERS_CELL });
    expect(result.lineup.bench).toEqual([STRIKER]);
  });

  test("not while his match is still to come, and not once he has played", () => {
    const { lineup, positions } = withBench(["ST"]);
    const stillToPlay = plays(lineup, [], [[STRIKER, "stillToPlay"]]);

    expect(subbed(lineup, positions, stillToPlay)).toEqual(untouched(lineup));
    expect(subbed(lineup, positions, plays(lineup, []))).toEqual(untouched(lineup));
  });

  test("every one who didn't play, with no limit", () => {
    const { lineup, positions } = withBench(["GK"], ["CB"], ["CM"], ["ST"]);
    const absent = [KEEPER, LEFT_BACK, LEFT_MIDFIELDER, STRIKER];
    const result = subbed(lineup, positions, plays(lineup, absent));

    expect(result.substitutions.map(({ off, on }) => [off, on])).toEqual([
      [KEEPER, FIRST],
      [LEFT_BACK, SECOND],
      [LEFT_MIDFIELDER, THIRD],
      [STRIKER, FOURTH],
    ]);
    expect(result.lineup.bench).toEqual(absent);
  });
});

describe("who comes on", () => {
  test("the first on the bench who can play the slot's area takes the slot", () => {
    const { lineup, positions } = withBench(["CB"], ["CM"], ["SS"], ["ST"]);
    const result = subbed(lineup, positions, plays(lineup, [STRIKER]));

    expect(result.substitutions).toEqual([strikerReplacedBy(THIRD)]);
  });

  test("a sub who also didn't play is passed over", () => {
    const { lineup, positions } = withBench(["ST"], ["ST"]);
    const result = subbed(lineup, positions, plays(lineup, [STRIKER, FIRST]));

    expect(result.substitutions).toEqual([strikerReplacedBy(SECOND)]);
    expect(result.lineup.bench).toEqual([FIRST, STRIKER]);
  });

  test("a sub still to play comes on, provisionally, in his bench order", () => {
    const { lineup, positions } = withBench(["ST"], ["ST"]);
    const result = subbed(lineup, positions, plays(lineup, [STRIKER], [[FIRST, "stillToPlay"]]));

    expect(result.substitutions).toEqual([strikerReplacedBy(FIRST)]);
  });

  test("a wing back can't take a central midfield slot, only a wide one", () => {
    const leftCentreMidfielder = LEFT_MIDFIELDER + 1;
    const { lineup, positions } = withBench(["WB"], ["CM"]);
    const centralSlot = subbed(lineup, positions, plays(lineup, [leftCentreMidfielder]));
    const wideSlot = subbed(lineup, positions, plays(lineup, [LEFT_MIDFIELDER]));

    expect(centralSlot.substitutions.map(({ on, into }) => [on, into])).toEqual([[SECOND, "theSlot"]]);
    expect(wideSlot.substitutions.map(({ on, into }) => [on, into])).toEqual([[FIRST, "theSlot"]]);
  });

  test("absentees are filled back to front, so the bench's first goes to the deepest slot he plays", () => {
    const { lineup, positions } = withBench(["CB", "ST"], ["ST"]);
    const result = subbed(lineup, positions, plays(lineup, [STRIKER, LEFT_CENTRE_BACK]));

    expect(result.substitutions.map(({ off, on }) => [off, on])).toEqual([
      [LEFT_CENTRE_BACK, FIRST],
      [STRIKER, SECOND],
    ]);
  });
});

describe("when no one on the bench can play the slot", () => {
  test("the first who keeps the area limits legal comes on in his own area, and the formation changes", () => {
    const { lineup, positions } = withBench(["CB"], ["CM"]);
    const backFourOnly = openLimits({ defence: { minimum: 3, maximum: 4 } });
    const result = subbed(lineup, positions, plays(lineup, [STRIKER]), backFourOnly);

    expect(result.substitutions).toEqual([
      { off: STRIKER, on: SECOND, area: "midfield", lane: "centre", into: "hisOwnArea" },
    ]);
  });

  test("he takes the slot's lane in his own area when it is free", () => {
    const { lineup, positions } = withBench(["CAM"]);
    const result = subbed(lineup, positions, plays(lineup, [STRIKER]));

    expect(result.substitutions).toEqual([
      { off: STRIKER, on: FIRST, area: "attackingMidfield", lane: "leftCentre", into: "hisOwnArea" },
    ]);
  });

  test("otherwise the nearest free lane, the left one on a tie", () => {
    // 4-3-3: the three central midfielders stand left-centre, centre and right-centre; 11 is the
    // lone striker, in the centre.
    const { lineup: filled, positions: starters } = filledLineup(presetNamed("4-3-3"));
    const fourThreeThree = { ...filled, bench: [FIRST] };
    const loneStriker = 11;
    const positions = withPositions(starters, FIRST, ["CM"]);
    const result = subbed(fourThreeThree, positions, plays(fourThreeThree, [loneStriker]));

    expect(result.substitutions).toEqual([
      { off: loneStriker, on: FIRST, area: "midfield", lane: "left", into: "hisOwnArea" },
    ]);
  });

  test("the nearest area before the nearest lane", () => {
    // The other striker drops into the hole behind: a sub who plays the area in front of the
    // midfield, or the one behind it, takes the nearer, though only the other has a free lane.
    const { lineup, positions } = withBench(["CAM", "CDM"]);
    const supportStriker = withPositions(positions, OTHER_STRIKER, ["SS"]);
    const strikerInTheHole = {
      ...lineup,
      starters: lineup.starters.map((starter) =>
        starter.playerCode === OTHER_STRIKER ? { ...starter, area: "attackingMidfield", lane: "leftCentre" } : starter,
      ),
    };
    const result = subbed(strikerInTheHole, supportStriker, plays(strikerInTheHole, [STRIKER]));

    expect(result.substitutions).toEqual([
      { off: STRIKER, on: FIRST, area: "attackingMidfield", lane: "left", into: "hisOwnArea" },
    ]);
  });

  test("the further back of two areas as near", () => {
    const { lineup, positions } = withBench(["CDM", "CAM"]);
    const result = subbed(lineup, positions, plays(lineup, [LEFT_MIDFIELDER]));

    expect(result.substitutions).toEqual([
      { off: LEFT_MIDFIELDER, on: FIRST, area: "defensiveMidfield", lane: "left", into: "hisOwnArea" },
    ]);
  });

  test("of his areas, the nearest the slot's", () => {
    // A support striker plays attacking midfield and attack: for a full back's slot, the nearer.
    const { lineup, positions } = withBench(["SS"]);
    const result = subbed(lineup, positions, plays(lineup, [LEFT_BACK]));

    expect(result.substitutions).toEqual([
      { off: LEFT_BACK, on: FIRST, area: "attackingMidfield", lane: "left", into: "hisOwnArea" },
    ]);
  });
});

describe("a keeper", () => {
  test("is replaced only by a keeper, even with outfield players first on the bench", () => {
    const { lineup, positions } = withBench(["CB"], ["GK"]);
    const result = subbed(lineup, positions, plays(lineup, [KEEPER]));

    expect(result.substitutions).toEqual([
      { off: KEEPER, on: SECOND, area: "goalkeeper", lane: "centre", into: "theSlot" },
    ]);
  });

  test("never comes on for an outfield player, even with room in goal", () => {
    const { lineup, positions } = withBench(["GK"]);
    const roomForTwo = openLimits({ goalkeeper: { minimum: 1, maximum: 2 } });
    const result = subbed(lineup, positions, plays(lineup, [STRIKER]), roomForTwo);

    expect(result).toEqual(untouched(lineup, [STRIKER]));
  });

  test("with no keeper on the bench, the keeper's slot scores nothing", () => {
    const { lineup, positions } = withBench(["CB"], ["ST"]);
    const result = subbed(lineup, positions, plays(lineup, [KEEPER]));

    expect(result).toEqual(untouched(lineup, [KEEPER]));
  });
});

describe("when no one can come on legally", () => {
  test("no one does, and the slot scores nothing", () => {
    const { lineup, positions } = withBench(["CB"], ["CM"]);
    const noRoomElsewhere = openLimits({
      defence: { minimum: 4, maximum: 4 },
      midfield: { minimum: 4, maximum: 4 },
      attack: { minimum: 2, maximum: 2 },
    });
    const result = subbed(lineup, positions, plays(lineup, [STRIKER]), noRoomElsewhere);

    expect(result).toEqual(untouched(lineup, [STRIKER]));
  });

  test("one slot scoring nothing doesn't stop the next being filled", () => {
    const { lineup, positions } = withBench(["CB"]);
    const result = subbed(lineup, positions, plays(lineup, [KEEPER, OTHER_STRIKER]));

    expect(result.unfilled).toEqual([KEEPER]);
    expect(result.substitutions.map(({ off, on }) => [off, on])).toEqual([[OTHER_STRIKER, FIRST]]);
  });
});

describe("a double gameweek", () => {
  const finished = (minutes: number) => ({ finished: true, minutes });
  const toCome = { finished: false, minutes: 0 };

  test("a starter who plays in either match played", () => {
    expect(gameweekPlay([finished(0), finished(30)])).toBe("played");
    expect(gameweekPlay([finished(90), toCome])).toBe("played");
  });

  test("a starter on 0 minutes after his first match is still to play until the second ends", () => {
    expect(gameweekPlay([finished(0), toCome])).toBe("stillToPlay");
    expect(gameweekPlay([finished(0), finished(0)])).toBe("didNotPlay");
  });

  test("is subbed only once both his matches end with him on 0 minutes", () => {
    const { lineup, positions } = withBench(["ST"]);
    const after = (matches: PlayerMatch[]) =>
      subbed(lineup, positions, plays(lineup, [], [[STRIKER, gameweekPlay(matches)]])).substitutions;

    expect(after([finished(0), toCome])).toEqual([]);
    expect(after([finished(0), finished(1)])).toEqual([]);
    expect(after([finished(0), finished(0)])).toEqual([strikerReplacedBy(FIRST)]);
  });

  test("a player with no match in the gameweek didn't play", () => {
    expect(gameweekPlay([])).toBe("didNotPlay");
  });
});

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

  test("a lineup that may not stand", () => {
    const tenMen = { ...fourFourTwo, starters: fourFourTwo.starters.slice(1) };

    expect(() => autoSubs(tenMen, startersPositions, plays(tenMen, []), openLimits())).toThrow(/wrongStarterCount/);
  });

  test("but not a starter who lost a position after he was placed: he stays, and the subs around him still come on", () => {
    const { lineup, positions } = withBench(["ST"]);
    const strikerNowAMidfielder = withPositions(positions, OTHER_STRIKER, ["CM"]);
    const result = autoSubs(lineup, strikerNowAMidfielder, plays(lineup, [STRIKER]), openLimits());

    expect(result.substitutions).toEqual([strikerReplacedBy(FIRST)]);
  });
});
