// Where a player picked up on the Tactics tab can go, and why a drop is refused (spec/05, The pitch
// and Moving players; #851; #1022). Presets only: a player only ever swaps, starter for starter or
// bench for starter, never into an empty cell, and a refused drop says why (Craig, 1 and 4 Nov 2026).

import { describe, expect, it } from "vitest";
import { AREAS, type Cell } from "../../../../convex/lineup/pitch";
import { rolesOfSlot } from "../../../../convex/lineup/roles";
import type { Position } from "../../../../convex/positions/positionTables";
import { NO_DATA } from "../../../../convex/stars/starsShape";
import { landingOf, swapped, withRole, type MoveRules, type RatingsOf } from "../../../../src/myTeam/tactics/lineupEdits";
import { canSwap, dropOutcome, reachOf } from "../../../../src/myTeam/tactics/swaps";

const KEEPER = { playerCode: 1, area: "goalkeeper", lane: "centre" } as const;
const BACK = { playerCode: 2, area: "defence", lane: "left" } as const;
const DRAFT = { starters: [KEEPER, BACK], bench: [3, 4] };
const NO_STARS: RatingsOf = () => [];
const limit = (minimum: number, maximum: number) => ({ minimum, maximum });
const rulesFor = (positions: Record<number, Position[]>, defence = limit(0, 2)): MoveRules => ({
  areaLimits: { ...Object.fromEntries(AREAS.map((area) => [area, limit(0, 10)])), goalkeeper: limit(1, 1), defence } as MoveRules["areaLimits"],
  positionsOf: (playerCode) => positions[playerCode] ?? [],
});

describe("where a player picked up can go (spec/05, Moving players; #851)", () => {
  /** One keeper exactly, at most two in defence, anyone anywhere else. */
  const RULES = rulesFor({ 1: ["GK"], 2: ["CB"], 3: ["GK"], 4: ["CB", "CM"], 6: ["FB"] });
  const DEFENCE_FULL = { starters: [KEEPER, BACK, { playerCode: 6, area: "defence", lane: "right" } as const], bench: [3, 4] };

  it("lights a taken cell he may swap into, and only where both play the cell they land in", () => {
    expect(dropOutcome(DRAFT, 3, { cell: KEEPER }, RULES)).toEqual({ swapWith: 1 });
    expect(canSwap(DRAFT, 3, 1, RULES)).toBe(true);
    // A centre back can't go in goal, so the keeper can't swap with him.
    expect(canSwap(DRAFT, 1, 2, RULES)).toBe(false);
    expect(canSwap(DRAFT, 3, 4, RULES)).toBe(false);
    expect(canSwap(DRAFT, 2, 2, RULES)).toBe(false);
  });

  it("lights no empty cell: there is none to move into (Craig, 1 Nov 2026)", () => {
    expect(dropOutcome(DRAFT, 4, { cell: { area: "defence", lane: "centre" } }, RULES)).toEqual({ refusal: { kind: "emptyCell" } });
    expect(dropOutcome(DRAFT, 2, { cell: { area: "defence", lane: "right" } }, RULES)).toEqual({ refusal: { kind: "emptyCell" } });
  });

  it("is every player canSwap allows", () => {
    for (const draft of [DRAFT, DEFENCE_FULL]) {
      for (const playerCode of [1, 2, 3, 4, 6]) {
        expect(reachOf(draft, playerCode, RULES)).toEqual({
          players: [...draft.starters.map((starter) => starter.playerCode), ...draft.bench].filter((other) => canSwap(draft, playerCode, other, RULES)),
        });
      }
    }
    expect(reachOf(DRAFT, 3, RULES)).toEqual({ players: [1] });
    expect(reachOf(DEFENCE_FULL, 4, RULES)).toEqual({ players: [2, 6] });
  });
});

describe("the stars a lit player shows (spec/05, Moving players; Craig, 7 Nov 2026, #11)", () => {
  const BENCH_BACK = 4;
  /** A role of the left-back's slot other than its first, so only his stars put him on it. */
  const playmaker = rolesOfSlot(BACK, DRAFT.starters)[1];
  const ratingsOf: RatingsOf = (playerCode) => (playerCode === BENCH_BACK ? [{ area: "defence", role: playmaker.key, stars: 3.5 }] : []);

  it("a lit starter: the player picked up, on the role he has the most stars for in that slot", () => {
    expect(landingOf(DRAFT, BENCH_BACK, BACK.playerCode, ratingsOf)).toEqual({ playerCode: BENCH_BACK, role: playmaker, stars: 3.5 });
  });

  it("a lit bench player, a starter picked up: the bench player, on his best-star role in the starter's slot", () => {
    expect(landingOf(DRAFT, BACK.playerCode, BENCH_BACK, ratingsOf)).toEqual({ playerCode: BENCH_BACK, role: playmaker, stars: 3.5 });
  });

  it("no stars for the slot: its first role, and no figure", () => {
    const landing = landingOf(DRAFT, 3, KEEPER.playerCode, NO_STARS);
    expect(landing?.role).toEqual(rolesOfSlot(KEEPER, DRAFT.starters)[0]);
    expect(landing?.stars).toBe(NO_DATA);
  });

  it("two on the bench: nobody lands", () => {
    expect(landingOf(DRAFT, 3, BENCH_BACK, NO_STARS)).toBeNull();
  });
});

describe("a refused drop says why (spec/05; Craig, 4 Nov 2026)", () => {
  const RULES = rulesFor({ 1: ["GK"], 2: ["CB"], 3: ["GK"], 4: ["ST"], 5: ["CM"] });
  const MIDFIELDER = { playerCode: 5, area: "midfield", lane: "centre" } as const;
  const WITH_MIDFIELD = { starters: [KEEPER, BACK, MIDFIELDER], bench: [3, 4] };

  it("onto the bench's plate: a starter leaves the pitch only by a swap", () => {
    expect(dropOutcome(DRAFT, 2, "bench", RULES)).toEqual({ refusal: { kind: "offThePitch" } });
  });

  it("an outfield player in goal, or a keeper out of it", () => {
    expect(dropOutcome(DRAFT, 4, { cell: KEEPER }, RULES)).toEqual({ refusal: { kind: "goal" } });
    expect(dropOutcome(DRAFT, 3, { playerCode: 2 }, RULES)).toEqual({ refusal: { kind: "goal" } });
    expect(dropOutcome(DRAFT, 1, { cell: BACK }, RULES)).toEqual({ refusal: { kind: "goal" } });
  });

  it("a player into a cell his positions don't play, naming him and the cell", () => {
    expect(dropOutcome(DRAFT, 4, { cell: BACK }, RULES)).toEqual({ refusal: { kind: "doesNotPlay", playerCode: 4, cell: { area: "defence", lane: "left" } } });
    // Neither plays where he'd land: the midfielder, landing in defence, is named.
    expect(dropOutcome(WITH_MIDFIELD, 2, { playerCode: 5 }, RULES)).toEqual({ refusal: { kind: "doesNotPlay", playerCode: 5, cell: { area: "defence", lane: "left" } } });
  });

  it("swaps where none of these stand in the way, by a drop on his cell or his row", () => {
    expect(dropOutcome(DRAFT, 3, { playerCode: 1 }, RULES)).toEqual({ swapWith: 1 });
    expect(dropOutcome(DRAFT, 1, { playerCode: 3 }, RULES)).toEqual({ swapWith: 3 });
  });
});

describe("a back five's centre-backs (Craig, 1 Nov 2026: \"make sure we allow the cbs to be swapped in a 5\")", () => {
  const at = (playerCode: number, lane: Cell["lane"]) => ({ playerCode, area: "defence", lane }) as const;
  const LEFT_CB = at(22, "leftCentre");
  const MIDDLE_CB = at(23, "centre");
  const RIGHT_CB = at(24, "rightCentre");
  const FIVE = { starters: [KEEPER, at(21, "left"), LEFT_CB, MIDDLE_CB, RIGHT_CB, at(25, "right")], bench: [26] };
  const RULES = rulesFor({ 1: ["GK"], 21: ["FB"], 22: ["CB"], 23: ["CB"], 24: ["CB"], 25: ["FB"], 26: ["CB"] }, limit(3, 5));
  const CENTRE_BACKS = [LEFT_CB, MIDDLE_CB, RIGHT_CB];
  const cellOf = (starter: Cell) => ({ area: starter.area, lane: starter.lane });

  it("any one swaps with any other, into and out of the middle cell, each landing in the other's cell", () => {
    for (const one of CENTRE_BACKS) {
      for (const other of CENTRE_BACKS.filter((each) => each !== one)) {
        expect(canSwap(FIVE, one.playerCode, other.playerCode, RULES)).toBe(true);
        expect(dropOutcome(FIVE, one.playerCode, { cell: cellOf(other) }, RULES)).toEqual({ swapWith: other.playerCode });
        const after = swapped(FIVE, one.playerCode, other.playerCode, NO_STARS);
        expect(after.starters).toContainEqual({ ...cellOf(other), playerCode: one.playerCode });
        expect(after.starters).toContainEqual({ ...cellOf(one), playerCode: other.playerCode });
      }
    }
  });

  it("each lights the other two, and a centre-back on the bench lights all three", () => {
    expect(reachOf(FIVE, 22, RULES).players).toEqual(expect.arrayContaining([23, 24]));
    expect(reachOf(FIVE, 26, RULES).players).toEqual(expect.arrayContaining([22, 23, 24]));
    expect(dropOutcome(FIVE, 26, { cell: cellOf(MIDDLE_CB) }, RULES)).toEqual({ swapWith: 23 });
  });

  it("any of the three centre-backs can take a sweeper or libero role, not only the middle one (spec/05, 5 Nov 2026)", () => {
    for (const centreBack of CENTRE_BACKS) {
      expect(rolesOfSlot(cellOf(centreBack), FIVE.starters).map(({ key }) => key)).toEqual(expect.arrayContaining(["sweeper", "libero"]));
    }
    const sweeping = withRole(FIVE, 22, "sweeper").starters.find((starter) => starter.playerCode === 22)!;
    expect(sweeping.role).toBe("sweeper");
  });

  it("a sweeper swapped to another centre-back cell starts there afresh, on his best-star role (none here, so the slot's first)", () => {
    const sweeping = withRole(FIVE, 23, "sweeper");
    const after = swapped(sweeping, 23, 24, NO_STARS);
    const moved = after.starters.find((starter) => starter.playerCode === 23)!;
    expect(cellOf(moved)).toEqual(cellOf(RIGHT_CB));
    expect(moved.role).toBeUndefined();
  });
});
