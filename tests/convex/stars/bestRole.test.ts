import { describe, expect, test } from "vitest";
import { DEFAULT_ROLES } from "../../../convex/lineup/roles";
import { DEFAULT_PRESETS } from "../../../convex/lineup/presets";
import { bestRoleIn, droppedRole } from "../../../convex/stars/bestRole";
import { NO_DATA, UNSURE, type RoleStars } from "../../../convex/stars/starsShape";

// The role a player dropped into a slot starts on (spec/05 Roles; Craig, 1 Nov 2026): his most
// stars there among the roles it offers, the slot's first on a tie or with none.

const STRIKER = { area: "attack", lane: "centre" } as const;
const NUMBER_TEN = { area: "attackingMidfield", lane: "centre" } as const;
const CENTRE_BACK = { area: "defence", lane: "centre" } as const;
const [POACHER, TARGET_MAN, PRESSING_FORWARD] = DEFAULT_ROLES.ST;
const up = (role: string, stars: RoleStars["stars"], area: RoleStars["area"] = "attack"): RoleStars => ({ area, role, stars });
const cellsOf = (name: string) => DEFAULT_PRESETS.find((preset) => preset.name === name)!.cells;

describe("his best role in a slot", () => {
  test("the one he has the most stars for", () => {
    expect(bestRoleIn(STRIKER, DEFAULT_ROLES.ST, [up(POACHER.key, 2), up(TARGET_MAN.key, 4.5), up(PRESSING_FORWARD.key, 3)])).toBe(TARGET_MAN);
  });

  test("a tie goes to the role the slot offers first", () => {
    expect(bestRoleIn(STRIKER, DEFAULT_ROLES.ST, [up(TARGET_MAN.key, 4), up(PRESSING_FORWARD.key, 4)])).toBe(TARGET_MAN);
    expect(bestRoleIn(STRIKER, DEFAULT_ROLES.ST, [up(PRESSING_FORWARD.key, 4), up(POACHER.key, 4)])).toBe(POACHER);
  });

  test("“?” or “—” for every role: the slot's first", () => {
    expect(bestRoleIn(STRIKER, DEFAULT_ROLES.ST, DEFAULT_ROLES.ST.map((role) => up(role.key, UNSURE)))).toBe(POACHER);
    expect(bestRoleIn(STRIKER, DEFAULT_ROLES.ST, DEFAULT_ROLES.ST.map((role) => up(role.key, NO_DATA)))).toBe(POACHER);
    expect(bestRoleIn(STRIKER, DEFAULT_ROLES.ST, [])).toBe(POACHER);
  });

  test("a role's stars in another area don't count: a shadow striker is rated apart at number 10", () => {
    const shadow = DEFAULT_ROLES.CAM[1];
    expect(bestRoleIn(NUMBER_TEN, DEFAULT_ROLES.CAM, [up(shadow.key, 5, "attack"), up(DEFAULT_ROLES.CAM[0].key, 1, "attackingMidfield")])).toBe(DEFAULT_ROLES.CAM[0]);
  });
});

describe("the role he is saved on when dropped", () => {
  const FOUR_FOUR_TWO = cellsOf("4-4-2");

  test("his best role's key", () => {
    expect(droppedRole(STRIKER, FOUR_FOUR_TWO, [up(TARGET_MAN.key, 4)], ["ST"])).toBe(TARGET_MAN.key);
  });

  test("none for the slot's first, which a starter with none given plays", () => {
    expect(droppedRole(STRIKER, FOUR_FOUR_TWO, [up(POACHER.key, 5)], ["ST"])).toBeUndefined();
    expect(droppedRole(STRIKER, FOUR_FOUR_TWO, [], ["ST"])).toBeUndefined();
  });

  test("a centre-back best as a sweeper starts on it only in a back three", () => {
    const sweeperBest = [up("sweeper", 5, "defence"), up("noNonsenseCentreBack", 3, "defence")];
    expect(droppedRole(CENTRE_BACK, cellsOf("3-5-2"), sweeperBest, ["CB"])).toBe("sweeper");
    expect(droppedRole({ area: "defence", lane: "leftCentre" }, FOUR_FOUR_TWO, sweeperBest, ["CB"])).toBe("noNonsenseCentreBack");
  });

  // S05.29
  test("only among the roles he may take: a CAM up front is a false 9, whatever his stars", () => {
    expect(droppedRole(STRIKER, FOUR_FOUR_TWO, [up(POACHER.key, 5)], ["CAM"])).toBe("falseNine");
    expect(droppedRole(STRIKER, FOUR_FOUR_TWO, [up(POACHER.key, 5)], ["CAM", "SS"])).toBeUndefined();
    const wide = { area: "attackingMidfield", lane: "left" } as const;
    const pressingBest = [up("pressingWinger", 5, "attackingMidfield"), up("dribbler", 2, "attackingMidfield")];
    expect(droppedRole(wide, cellsOf("4-2-3-1"), pressingBest, ["WM"])).toBe("dribbler");
    expect(droppedRole(wide, cellsOf("4-2-3-1"), pressingBest, ["W"])).toBe("pressingWinger");
  });
});
