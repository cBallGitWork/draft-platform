// Clubs and players are never deleted, only marked dropped, so seasons pile up (#142): the admin's
// positions read only today's clubs and players, and say so loudly when there are more than a
// read holds, never cutting the list short.

import { describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { CLUB_PLAYERS_MOST, CURRENT_CLUBS_MOST } from "../../../convex/shared/players";
import { asAdmin, newcastleMen, synced, SYNCED_CLUBS } from "../../support/convex/positionsSync.harness";
import { NEWCASTLE } from "../../support/recorded/positions.payloads";
import type { TestConvex } from "../../support/convex/test.harness";

describe("as seasons pile up, nothing is cut short silently", () => {
  /** `count` clubs from code 1000, dropped by the feed unless `current`. */
  const holdClubs = (t: TestConvex, count: number, current = false) =>
    t.run(async (ctx) => {
      for (let index = 0; index < count; index += 1) {
        await ctx.db.insert("clubs", { code: 1000 + index, name: `Club ${index}`, shortName: "OLD", ...(current ? {} : { droppedAt: Date.now() }) });
      }
    });

  test("approving a club leaves out a player who has left it, and gives him no row", async () => {
    const t = await synced();
    const LEFT = 777;
    await t.run((ctx) => ctx.db.insert("players", { code: LEFT, name: "Left", fullName: "Long Left", clubCode: NEWCASTLE.code, droppedAt: Date.now() }));

    const approved = await (await asAdmin(t)).mutation(api.positions.playerPositions.approveClub, { clubCode: NEWCASTLE.code });

    expect(approved).toBe(newcastleMen().length);
    expect(await t.run((ctx) => ctx.db.query("playerPositions").withIndex("by_code", (q) => q.eq("code", LEFT)).unique())).toBeNull();
  });

  test(`a club with more than ${CLUB_PLAYERS_MOST} current players can't be approved, and says why`, async () => {
    const t = await synced();
    const CROWDED = 55;
    await t.run(async (ctx) => {
      for (let index = 0; index <= CLUB_PLAYERS_MOST; index += 1) {
        await ctx.db.insert("players", { code: 50_000 + index, name: `P${index}`, fullName: `P${index}`, clubCode: CROWDED });
      }
    });
    await expect((await asAdmin(t)).mutation(api.positions.playerPositions.approveClub, { clubCode: CROWDED })).rejects.toThrow(
      `More than ${CLUB_PLAYERS_MOST} players are held at club ${CROWDED}`,
    );
  });

  test(`the queue's clubs are today's, however many clubs have been dropped before them`, async () => {
    const t = await synced();
    await holdClubs(t, CURRENT_CLUBS_MOST + 5);
    expect((await (await asAdmin(t)).query(api.positions.playerPositions.queue, {})).clubs).toEqual(
      SYNCED_CLUBS.map(({ code, name }) => ({ code, name })).sort((one, other) => one.name.localeCompare(other.name)),
    );
  });

  test(`more than ${CURRENT_CLUBS_MOST} current clubs fail the queue loudly, never a list cut short`, async () => {
    const t = await synced();
    await holdClubs(t, CURRENT_CLUBS_MOST + 1, true);
    await expect((await asAdmin(t)).query(api.positions.playerPositions.queue, {})).rejects.toThrow(`More than ${CURRENT_CLUBS_MOST} clubs are held as current`);
  });
});
