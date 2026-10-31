import { describe, expect, test } from "vitest";
import { firstLineup, keptOnBenchOf, type FirstLineup, type FirstLineupRules } from "../../../convex/lineup/firstLineup";
import { DEFAULT_PRESETS } from "../../../convex/lineup/presets";
import type { Position } from "../../../convex/positions/positionTables";
import { openLimits, presetNamed } from "../../support/convex/lineup.harness";

// A team's first lineup (spec/05, The pitch; #637, #836): each pick goes onto the pitch as it is
// made, into the deepest open 4-4-2 slot he can play, or onto the bench in pick order; if the
// 4-4-2 leaves a slot empty, the first preset the squad fills within the league's area limits.

/** Players by code, each with his positions, in the order they were picked. */
const picked = (...players: [number, Position[]][]) => ({
  order: players.map(([code]) => code),
  positions: new Map(players),
});

/** The league's presets in spec/05's order, under limits that refuse nothing. */
const RULES: FirstLineupRules = { ...openLimits(), presets: DEFAULT_PRESETS };
/** A league with no preset to fall back on: only the 4-4-2's own rule is in play. */
const NO_FALLBACK: FirstLineupRules = { ...openLimits(), presets: [] };

const KEEPER = { area: "goalkeeper", lane: "centre" } as const;
const BACK_FOUR = (["left", "leftCentre", "rightCentre", "right"] as const).map((lane) => ({ area: "defence", lane }) as const);
const FLAT_FOUR = (["left", "leftCentre", "rightCentre", "right"] as const).map((lane) => ({ area: "midfield", lane }) as const);
const STRIKE_PAIR = (["leftCentre", "rightCentre"] as const).map((lane) => ({ area: "attack", lane }) as const);

/** Each code in the cells, in order. */
const standing = (codes: number[], cells: readonly { area: string; lane: string }[]) =>
  codes.map((playerCode, index) => ({ playerCode, ...cells[index] }));

describe("each pick goes onto the 4-4-2 as it is made", () => {
  test("a full squad fills the 4-4-2 in the order it was picked, the rest on the bench in that order", () => {
    const { order, positions } = picked(
      [1, ["ST"]], [2, ["GK"]], [3, ["CB"]], [4, ["FB"]], [5, ["CM"]], [6, ["CB"]], [7, ["WM"]], [8, ["ST"]],
      [9, ["GK"]], [10, ["CB"]], [11, ["CM"]], [12, ["CM"]], [13, ["FB"]], [14, ["ST"]], [15, ["CM"]],
    );
    expect(firstLineup(order, positions, RULES)).toEqual({
      starters: [
        { playerCode: 2, ...KEEPER },
        ...standing([3, 4, 6, 10], BACK_FOUR),
        ...standing([5, 7, 11, 12], FLAT_FOUR),
        ...standing([1, 8], STRIKE_PAIR),
      ],
      bench: [9, 13, 14, 15],
    });
  });

  test("a player who plays two areas goes into the deepest he can: a wing back the back four", () => {
    const { order, positions } = picked([1, ["WB"]], [2, ["WM"]]);
    expect(firstLineup(order, positions, RULES)).toEqual({
      starters: [{ playerCode: 1, ...BACK_FOUR[0] }, { playerCode: 2, ...FLAT_FOUR[0] }],
      bench: [],
    });
  });

  test("a fifth striker goes on the bench, behind the others benched before him", () => {
    const { order, positions } = picked([1, ["ST"]], [2, ["ST"]], [3, ["ST"]], [4, ["CM"]], [5, ["ST"]], [6, ["ST"]]);
    expect(firstLineup(order, positions, RULES)).toEqual({
      starters: [...standing([4], FLAT_FOUR), ...standing([1, 2], STRIKE_PAIR)],
      bench: [3, 5, 6],
    });
  });

  test("a slot nobody can play stays empty, and only a keeper goes in goal", () => {
    const { order, positions } = picked([1, ["CB"]], [2, ["CB"]]);
    expect(firstLineup(order, positions, RULES)).toEqual({ starters: standing([1, 2], BACK_FOUR), bench: [] });
  });

  test("a player with no positions yet, or none known, sits on the bench", () => {
    expect(firstLineup([1, 2], new Map([[1, []]]), RULES)).toEqual({ starters: [], bench: [1, 2] });
  });

  test("an empty squad has an empty lineup", () => {
    expect(firstLineup([], new Map(), RULES)).toEqual({ starters: [], bench: [] });
  });

  /** A seeded draw, so a failure can be run again. */
  const drawn = (seed: number) => {
    let state = seed;
    return (count: number) => {
      state = (state * 1103515245 + 12345) % 2 ** 31;
      return state % count;
    };
  };
  const DRAWN_POSITIONS: Position[][] = [["GK"], ["CB"], ["FB"], ["WB"], ["CM"], ["WM"], ["ST"], ["SS"], ["CB", "CDM"], ["WM", "W"], []];
  const SQUADS = 200;
  const SQUAD_SIZE = 18;

  test("placed one at a time, each pick lands where the whole sequence puts him, and no earlier pick moves", () => {
    for (let seed = 1; seed <= SQUADS; seed++) {
      const draw = drawn(seed);
      const players = Array.from({ length: SQUAD_SIZE }, (_, index) => [index + 1, DRAWN_POSITIONS[draw(DRAWN_POSITIONS.length)]] as [number, Position[]]);
      const { order, positions } = picked(...players);
      let before: FirstLineup = { starters: [], bench: [] };
      order.forEach((playerCode, index) => {
        const after = firstLineup(order.slice(0, index + 1), positions, NO_FALLBACK);
        const added = after.starters.filter((starter) => starter.playerCode === playerCode);
        expect(after.starters.filter((starter) => starter.playerCode !== playerCode), `seed ${seed}, pick ${index + 1}`).toEqual(before.starters);
        expect(after.bench).toEqual(added.length === 0 ? [...before.bench, playerCode] : before.bench);
        before = after;
      });
      expect(before).toEqual(firstLineup(order, positions, NO_FALLBACK));
    }
  });
});

describe("a squad that leaves a 4-4-2 slot empty takes the first preset it fills", () => {
  test("a wing back who would leave the midfield a man short fills it, in the league's 4-4-2", () => {
    const { order, positions } = picked(
      [1, ["GK"]], [2, ["WB"]], [3, ["CB"]], [4, ["CB"]], [5, ["CB"]], [6, ["CB"]], [7, ["CM"]], [8, ["CM"]], [9, ["CM"]], [10, ["ST"]], [11, ["ST"]],
    );
    expect(firstLineup(order, positions, NO_FALLBACK).starters).toHaveLength(10);
    expect(firstLineup(order, positions, RULES)).toEqual({
      starters: [
        { playerCode: 1, ...KEEPER },
        ...standing([3, 4, 5, 6], BACK_FOUR),
        ...standing([2, 7, 8, 9], FLAT_FOUR),
        ...standing([10, 11], STRIKE_PAIR),
      ],
      bench: [],
    });
  });

  /** Three centre backs and two holding men: no 4-4-2, but a 3-5-2. */
  const BACK_THREE_SQUAD = picked(
    [1, ["GK"]], [2, ["CB"]], [3, ["CB"]], [4, ["CB"]], [5, ["CDM"]], [6, ["CDM"]], [7, ["CM"]], [8, ["CM"]], [9, ["CM"]], [10, ["ST"]], [11, ["ST"]], [12, ["ST"]],
  );

  test("the first preset in the league's order the squad fills, the rest on the bench in pick order", () => {
    const { order, positions } = BACK_THREE_SQUAD;
    const threeFiveTwo = presetNamed("3-5-2").cells;
    expect(firstLineup(order, positions, RULES)).toEqual({
      starters: standing([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], threeFiveTwo),
      bench: [12],
    });
  });

  test("a preset outside the league's area limits is passed over: with none left, the 4-4-2 keeps its gaps", () => {
    const { order, positions } = BACK_THREE_SQUAD;
    const oneHoldingMan: FirstLineupRules = { ...openLimits({ defensiveMidfield: { minimum: 0, maximum: 1 } }), presets: DEFAULT_PRESETS };
    expect(firstLineup(order, positions, oneHoldingMan)).toEqual(firstLineup(order, positions, NO_FALLBACK));
    expect(firstLineup(order, positions, oneHoldingMan).starters).toHaveLength(9);
  });

  test("a league with no rules yet has only the 4-4-2", () => {
    const { order, positions } = BACK_THREE_SQUAD;
    expect(firstLineup(order, positions, null)).toEqual(firstLineup(order, positions, NO_FALLBACK));
  });
});

describe("a pick benched for having no positions stays there once he has some", () => {
  test("he is kept on the bench, and the 4-4-2 slot he could fill stays for a later pick", () => {
    const before = picked([1, ["GK"]], [2, []], [3, ["CB"]]);
    const held = firstLineup(before.order, before.positions, RULES);
    expect(held.bench).toEqual([2]);

    const after = picked([1, ["GK"]], [2, ["CB"]], [3, ["CB"]], [4, ["CB"]]);
    const kept = keptOnBenchOf(held, after.order, after.positions);
    expect(kept).toEqual(new Set([2]));
    expect(firstLineup(after.order, after.positions, RULES, kept)).toEqual({
      starters: [{ playerCode: 1, ...KEEPER }, ...standing([3, 4], BACK_FOUR)],
      bench: [2],
    });
    // Kept again on the next change, now a later pick holds a slot he could have had.
    const again = firstLineup(after.order, after.positions, RULES, kept);
    expect(keptOnBenchOf(again, after.order, after.positions)).toEqual(new Set([2]));
  });

  test("a pick benched for want of an open slot is not kept: he steps in when a slot opens", () => {
    const { order, positions } = picked([1, ["ST"]], [2, ["ST"]], [3, ["ST"]]);
    const held = firstLineup(order, positions, RULES);
    expect(keptOnBenchOf(held, order, positions)).toEqual(new Set());
    // The first striker leaves: the slot he held counts for nobody.
    expect(keptOnBenchOf(held, [2, 3], positions)).toEqual(new Set());
    expect(firstLineup([2, 3], positions, RULES).starters).toEqual(standing([2, 3], STRIKE_PAIR));
  });

  test("a holding man the 4-4-2 has no slot for is not kept, so a preset can use him", () => {
    const { order, positions } = picked([1, ["CDM"]], [2, ["GK"]]);
    expect(keptOnBenchOf(firstLineup(order, positions, RULES), order, positions)).toEqual(new Set());
  });

  test("a player kept on the bench fills no preset either", () => {
    const { order, positions } = picked(
      [1, ["GK"]], [2, ["CB"]], [3, ["CB"]], [4, ["CB"]], [5, ["CDM"]], [6, ["CDM"]], [7, ["CM"]], [8, ["CM"]], [9, ["CM"]], [10, ["ST"]], [11, ["ST"]],
    );
    expect(firstLineup(order, positions, RULES).starters).toHaveLength(11);
    expect(firstLineup(order, positions, RULES, new Set([5]))).toEqual(firstLineup(order, positions, NO_FALLBACK, new Set([5])));
  });
});
