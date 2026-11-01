import { describe, expect, test } from "vitest";
import { DEFAULT_ROLES } from "../../../convex/lineup/roles";
import { bestRoleIn, droppedRole } from "../../../convex/stars/bestRole";
import { NO_DATA, UNSURE, type RoleStars } from "../../../convex/stars/starsShape";

// The role a player dropped into a slot starts on (spec/05 Roles; Craig, 1 Nov 2026): his most
// stars there, the slot's first on a tie or with none.

const STRIKER = { area: "attack", lane: "centre" } as const;
const NUMBER_TEN = { area: "attackingMidfield", lane: "centre" } as const;
const [POACHER, TARGET_MAN, PRESSING_FORWARD] = DEFAULT_ROLES.ST;
const up = (role: string, stars: RoleStars["stars"], area: RoleStars["area"] = "attack"): RoleStars => ({ area, role, stars });

describe("his best role in a slot", () => {
  test("the one he has the most stars for", () => {
    expect(bestRoleIn(STRIKER, [up(POACHER.key, 2), up(TARGET_MAN.key, 4.5), up(PRESSING_FORWARD.key, 3)])).toBe(TARGET_MAN);
  });

  test("a tie goes to the role the slot offers first", () => {
    expect(bestRoleIn(STRIKER, [up(TARGET_MAN.key, 4), up(PRESSING_FORWARD.key, 4)])).toBe(TARGET_MAN);
    expect(bestRoleIn(STRIKER, [up(PRESSING_FORWARD.key, 4), up(POACHER.key, 4)])).toBe(POACHER);
  });

  test("“?” or “—” for every role: the slot's first", () => {
    expect(bestRoleIn(STRIKER, DEFAULT_ROLES.ST.map((role) => up(role.key, UNSURE)))).toBe(POACHER);
    expect(bestRoleIn(STRIKER, DEFAULT_ROLES.ST.map((role) => up(role.key, NO_DATA)))).toBe(POACHER);
    expect(bestRoleIn(STRIKER, [])).toBe(POACHER);
  });

  test("a role's stars in another area don't count: a shadow striker is rated apart at number 10", () => {
    const shadow = DEFAULT_ROLES.CAM[1];
    expect(bestRoleIn(NUMBER_TEN, [up(shadow.key, 5, "attack"), up(DEFAULT_ROLES.CAM[0].key, 1, "attackingMidfield")])).toBe(DEFAULT_ROLES.CAM[0]);
  });
});

describe("the role he is saved on when dropped", () => {
  test("his best role's key", () => {
    expect(droppedRole(STRIKER, [up(TARGET_MAN.key, 4)])).toBe(TARGET_MAN.key);
  });

  test("none for the slot's first, which a starter with none given plays", () => {
    expect(droppedRole(STRIKER, [up(POACHER.key, 5)])).toBeUndefined();
    expect(droppedRole(STRIKER, [])).toBeUndefined();
  });
});
