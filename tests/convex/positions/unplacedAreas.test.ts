import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { unplacedAreaRefusals } from "../../../convex/positions/unplacedAreas";
import { asAdmin, synced } from "../../support/convex/positionsSync.harness";
import { PLAYER } from "../../support/recorded/positions.payloads";
import { expectRefused } from "../../support/convex/test.harness";
import { insertClubs, ARSENAL } from "../../support/convex/footballRows.harness";

// The area of a player no feed has placed yet (#911, spec/06 `S06.1`): the admin sets it, and he
// counts towards that area's squad minimum until a feed places him (squads.test.ts has the count).

const UNPLACED = 990001;

test("the admin sets an unplaced player's area, finds him with it, and clears it", async () => {
  const t = await synced();
  await t.run(async (ctx) => {
    await insertClubs(ctx, [ARSENAL]);
    await ctx.db.insert("players", { code: UNPLACED, name: "Unplaced", fullName: "Ned Unplaced", clubCode: ARSENAL.code });
  });
  const admin = await asAdmin(t);
  const found = async () => (await admin.query(api.positions.playerPositions.find, { text: "Unplaced" })).map(({ positions, unplacedArea }) => ({ positions, unplacedArea }));
  expect(await found()).toEqual([{ positions: [], unplacedArea: null }]);

  await admin.mutation(api.positions.unplacedAreas.setUnplacedArea, { code: UNPLACED, area: "defence" });
  expect(await found()).toEqual([{ positions: [], unplacedArea: "defence" }]);

  await admin.mutation(api.positions.unplacedAreas.setUnplacedArea, { code: UNPLACED, area: null });
  expect(await found()).toEqual([{ positions: [], unplacedArea: null }]);
});

test("a player a feed has placed takes no area: his positions count", async () => {
  const t = await synced();
  await expectRefused((await asAdmin(t)).mutation(api.positions.unplacedAreas.setUnplacedArea, { code: PLAYER.barnes, area: "defence" }), unplacedAreaRefusals.placed);
});
