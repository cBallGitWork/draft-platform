import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIRST_INSTRUCTIONS, type InstructionPair } from "../../../convex/lineup/instructions";
import { pairRefusalWords } from "../../../convex/lineup/instructionsWords";
import { PLAN_NAME_MOST, PLANS_KEPT, planRefusals } from "../../../convex/lineup/lineupWords";
import { FIRST_PRESETS } from "../../../convex/lineup/presets";
import { DEFAULT_ROLES } from "../../../convex/lineup/roles";
import { positionOfSlot } from "../../../convex/lineup/pitch";
import { refusals } from "../../../convex/shared/leagueAccess";
import { expectRefused } from "../../support/convex/test.harness";
import { MANAGERS, actingAs, addManagers, adminCreatesLeague, type TestConvex } from "../../support/convex/leagues.harness";
import { fakeResend, signInDeployment } from "../../support/convex/signIn.harness";

// A manager's saved plans (spec/05, Saved plans; #992): a formation and every slot's role by name,
// never players; up to 5, saving under a name he has replaces it, and he deletes one to make room
// (Craig, 6 Nov 2026).

const [ANN, BOB, , , EVE] = MANAGERS;
const [FOUR_FOUR_TWO, FOUR_THREE_THREE] = FIRST_PRESETS;
/** The 4-4-2's slots, each on its position's last role: a role other than the slot's first. */
const PRESS = FOUR_FOUR_TWO.cells.map((cell) => ({ ...cell, role: DEFAULT_ROLES[positionOfSlot(cell)].at(-1)!.key }));

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  t = await signInDeployment();
  fakeResend();
  leagueId = await adminCreatesLeague(t);
  await addManagers(t, leagueId, [ANN, BOB]);
});

const as = async (email: string) => {
  const person = await actingAs(t, email);
  return {
    save: (name: string, slots: readonly { area: string; lane: string; role?: string }[] = PRESS) =>
      person.mutation(api.lineup.savedPlans.save, { leagueId, name, slots: [...slots] }),
    saveWith: (name: string, instructions: InstructionPair) => person.mutation(api.lineup.savedPlans.save, { leagueId, name, slots: [...PRESS], instructions }),
    remove: (name: string) => person.mutation(api.lineup.savedPlans.remove, { leagueId, name }),
    mine: () => person.query(api.lineup.savedPlans.mine, { leagueId }),
  };
};

describe("saving a plan", () => {
  test("keeps the formation and every slot's role by name, its spaces trimmed, never players", async () => {
    const ann = await as(ANN);
    await ann.save("  Press 4-4-2 ");
    expect(await ann.mine()).toEqual([{ name: "Press 4-4-2", slots: PRESS }]);
  });

  test("a slot given no role, or one its position doesn't hold, is saved on the role it plays", async () => {
    const ann = await as(ANN);
    await ann.save("Plain", FOUR_FOUR_TWO.cells.map((cell, index) => (index === 0 ? { ...cell, role: "noSuchRole" } : { ...cell })));
    const [plain] = await ann.mine();
    expect(plain.slots).toEqual(FOUR_FOUR_TWO.cells.map((cell) => ({ ...cell, role: DEFAULT_ROLES[positionOfSlot(cell)][0].key })));
  });

  test("each manager sees only his own team's plans", async () => {
    await (await as(ANN)).save("Press");
    expect(await (await as(BOB)).mine()).toEqual([]);
  });

  test("under a name he already has, it replaces that plan in its place", async () => {
    const ann = await as(ANN);
    await ann.save("Press");
    await ann.save("Deep");
    const replaced = FOUR_THREE_THREE.cells.map((cell) => ({ ...cell, role: DEFAULT_ROLES[positionOfSlot(cell)][0].key }));
    await ann.save("Press", replaced);
    expect(await ann.mine()).toEqual([
      { name: "Press", slots: replaced },
      { name: "Deep", slots: PRESS },
    ]);
  });

  test("a sixth is refused until he deletes one; replacing one of five still saves", async () => {
    const ann = await as(ANN);
    for (let index = 1; index <= PLANS_KEPT; index++) await ann.save(`Plan ${index}`);
    await expectRefused(ann.save("Plan 6"), planRefusals.full);
    await ann.save("Plan 1");
    await ann.remove("Plan 2");
    await ann.save("Plan 6");
    expect((await ann.mine()).map(({ name }) => name)).toEqual(["Plan 1", "Plan 3", "Plan 4", "Plan 5", "Plan 6"]);
  });

  test("a name of 1 to 30 characters", async () => {
    const ann = await as(ANN);
    await expectRefused(ann.save("   "), planRefusals.nameLength);
    await expectRefused(ann.save("x".repeat(PLAN_NAME_MOST + 1)), planRefusals.nameLength);
    await ann.save("x".repeat(PLAN_NAME_MOST));
    expect(await ann.mine()).toHaveLength(1);
  });

  test("eleven slots, each its own cell of the pitch", async () => {
    const ann = await as(ANN);
    await expectRefused(ann.save("Ten", PRESS.slice(1)), planRefusals.notEleven);
    await expectRefused(ann.save("Twice", [...PRESS.slice(1), PRESS[1]]), planRefusals.notEleven);
    await expectRefused(ann.save("Off", [{ area: "stands", lane: "centre", role: "x" }, ...PRESS.slice(1)]), planRefusals.notEleven);
    expect(await ann.mine()).toEqual([]);
  });

  test("keeps both team instructions with it, and refuses a pair its formation doesn't offer (#990)", async () => {
    const ann = await as(ANN);
    const pair = { attacking: "getItWide", defensive: "pressHigh" };
    await ann.saveWith("Wide", pair);
    expect(await ann.mine()).toEqual([{ name: "Wide", slots: PRESS, instructions: pair }]);
    // A 4-4-2 has four at the back, not five.
    const parked = { attacking: "playOutFromTheBack", defensive: "parkTheBus" };
    await expectRefused(ann.saveWith("Parked", parked), pairRefusalWords({ side: "defensive", key: "parkTheBus", blockedBy: "fiveAtTheBack" }, FIRST_INSTRUCTIONS));
    await expectRefused(ann.saveWith("Made up", { ...pair, attacking: "noSuchInstruction" }), pairRefusalWords({ side: "attacking", key: "noSuchInstruction" }, FIRST_INSTRUCTIONS));
    // Saved again without them, as a browser from before them does, it holds none.
    await ann.save("Wide");
    expect(await ann.mine()).toEqual([{ name: "Wide", slots: PRESS }]);
  });

  test("refused for anyone who runs no team in the league", async () => {
    await expectRefused((await as(EVE)).save("Press"), refusals.runsNoTeam);
  });
});

test("deleting a plan he has no plan by changes nothing", async () => {
  const ann = await as(ANN);
  await ann.save("Press");
  await ann.remove("Deep");
  expect((await ann.mine()).map(({ name }) => name)).toEqual(["Press"]);
});
