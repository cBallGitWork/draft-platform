import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { PL_LAST_COMP_SEASON } from "./football";
import { heldPositions, modules, syncPositionsWith, type TestConvex } from "./positionsSync.harness";
import { NEWCASTLE, PLAYER, recordedPositions, SHEET } from "./recorded/positions.payloads";
import schema from "./schema";

afterEach(() => vi.unstubAllGlobals());

/** The recorded men FPL lists at Newcastle. */
function newcastleMen() {
  return recordedPositions().fplElements.filter((each) => each.team === NEWCASTLE.fplId);
}

/** Synced from the recorded payloads, with Newcastle's men held by the football sync (#21). */
async function synced(): Promise<TestConvex> {
  const t = convexTest(schema, modules);
  await syncPositionsWith(t, recordedPositions());
  await t.run(async (ctx) => {
    for (const element of newcastleMen()) {
      await ctx.db.insert("players", { code: element.code, name: element.web_name, fullName: element.web_name, clubCode: NEWCASTLE.code });
    }
  });
  return t;
}

test("until the admin approves them, a player's starts are proposals and he plays on his label, unconfirmed", async () => {
  const t = await synced();

  const barnes = await t.query(internal.playerPositions.ofPlayer, { code: PLAYER.barnes });

  expect(barnes.proposals).toEqual(["W"]);
  expect(await heldPositions(t, PLAYER.barnes)).toEqual({ W: "label?" }); // "Left/Right Winger"
  expect(await heldPositions(t, PLAYER.joelinton)).toEqual({ CM: "label?" }); // "Left Central Midfielder"
});

test("approving a player confirms what his starts give him, and drops his label", async () => {
  const t = await synced();

  await t.mutation(internal.playerPositions.approvePlayer, { code: PLAYER.woltemade });

  expect(await heldPositions(t, PLAYER.woltemade)).toEqual({ ST: "starts" }); // his label gave SS
  expect((await t.query(internal.playerPositions.ofPlayer, { code: PLAYER.woltemade })).proposals).toEqual([]);
});

test("approving a club approves each of its men, and one with too few starts keeps his label, confirmed", async () => {
  const t = await synced();

  const approved = await t.mutation(internal.playerPositions.approveClub, { clubCode: NEWCASTLE.code });

  expect(approved).toBe(newcastleMen().length);
  expect(await heldPositions(t, PLAYER.barnes)).toEqual({ W: "starts" });
  expect(await heldPositions(t, PLAYER.thiaw)).toEqual({ CB: "starts" });
  expect(await heldPositions(t, PLAYER.hall)).toEqual({ FB: "label" }); // two starts at full back
});

test("a new signing with no starts plays on his label, unconfirmed until the admin approves him", async () => {
  const t = await synced();
  expect(await heldPositions(t, PLAYER.steur)).toEqual({ CM: "label?" }); // "Centre Central Midfielder"

  await t.mutation(internal.playerPositions.approvePlayer, { code: PLAYER.steur });

  expect(await heldPositions(t, PLAYER.steur)).toEqual({ CM: "label" });
});

test("with positions counting at once, starts count unconfirmed and stay in the queue", async () => {
  const t = await synced();

  await t.mutation(internal.playerPositions.setApproveMode, { approveMode: "countAtOnce" });

  expect(await heldPositions(t, PLAYER.barnes)).toEqual({ W: "starts?" });
  expect((await t.query(internal.playerPositions.ofPlayer, { code: PLAYER.barnes })).proposals).toEqual(["W"]);
});

test("the admin's corrections survive a recount: SS he marks stays, and a position he removes stays off", async () => {
  const t = convexTest(schema, modules);
  const payloads = recordedPositions();
  const lateNov = payloads.sheets.find((sheet) => sheet.id === SHEET.newcastleLateNov)!;
  payloads.sheets = payloads.sheets.filter((sheet) => sheet !== lateNov);
  payloads.fixtureLists[PL_LAST_COMP_SEASON] = payloads.fixtureLists[PL_LAST_COMP_SEASON].filter((fixture) => fixture.id !== lateNov.id);
  await syncPositionsWith(t, payloads);
  await t.mutation(internal.playerPositions.approvePlayer, { code: PLAYER.woltemade });
  await t.mutation(internal.playerPositions.setPosition, { code: PLAYER.woltemade, position: "SS" });
  await t.mutation(internal.playerPositions.removePosition, { code: PLAYER.woltemade, position: "ST" });

  await syncPositionsWith(t, recordedPositions()); // his fourth start up front arrives

  expect(await heldPositions(t, PLAYER.woltemade)).toEqual({ SS: "admin" });
  expect((await t.query(internal.playerPositions.ofPlayer, { code: PLAYER.woltemade })).proposals).toEqual([]);
});

test("a position the admin sets stays until he removes it, and setting it again undoes a removal", async () => {
  const t = await synced();
  await t.mutation(internal.playerPositions.approvePlayer, { code: PLAYER.thiaw });

  await t.mutation(internal.playerPositions.setPosition, { code: PLAYER.thiaw, position: "FB" });
  expect(await heldPositions(t, PLAYER.thiaw)).toEqual({ CB: "starts", FB: "admin" });

  await t.mutation(internal.playerPositions.removePosition, { code: PLAYER.thiaw, position: "FB" });
  expect(await heldPositions(t, PLAYER.thiaw)).toEqual({ CB: "starts" });

  await t.mutation(internal.playerPositions.setPosition, { code: PLAYER.thiaw, position: "FB" });
  expect(await heldPositions(t, PLAYER.thiaw)).toEqual({ CB: "starts", FB: "admin" });
});

test("a player no feed has named has no positions, and setting one gives him a row", async () => {
  const t = convexTest(schema, modules);
  const unknown = 999_999;
  expect(await heldPositions(t, unknown)).toEqual({});

  await t.mutation(internal.playerPositions.setPosition, { code: unknown, position: "GK" });

  expect(await heldPositions(t, unknown)).toEqual({ GK: "admin" });
});
