import { describe, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import { refusals } from "../../../convex/shared/leagueAccess";
import { ADMIN, actingAs } from "../../support/convex/leagues.harness";
import { PL_LAST_COMP_SEASON } from "../../../convex/football/football";
import { asAdmin, heldPositions, newcastleMen, reported, synced, syncPositionsWith } from "../../support/convex/positionsSync.harness";
import { BRENTFORD_CODE, NEWCASTLE, PLAYER, recordedPositions, SHEET } from "../../support/recorded/positions.payloads";
import { freshConvex, silenceConsoleError } from "../../support/convex/test.harness";

test("until the admin approves them, a player's starts are proposals and he plays on his label, unconfirmed", async () => {
  const t = await synced();

  const barnes = await (await asAdmin(t)).query(api.positions.playerPositions.ofPlayer, { code: PLAYER.barnes });

  expect(barnes.proposals).toEqual(["W"]);
  expect(await heldPositions(t, PLAYER.barnes)).toEqual({ W: "label?" }); // "Left/Right Winger"
  expect(await heldPositions(t, PLAYER.joelinton)).toEqual({ CM: "label?" }); // "Left Central Midfielder"
});

test("approving a player confirms what his starts give him, and drops his label", async () => {
  const t = await synced();

  await (await asAdmin(t)).mutation(api.positions.playerPositions.approvePlayer, { code: PLAYER.woltemade });

  expect(await heldPositions(t, PLAYER.woltemade)).toEqual({ ST: "starts" }); // his label gave SS
  expect((await (await asAdmin(t)).query(api.positions.playerPositions.ofPlayer, { code: PLAYER.woltemade })).proposals).toEqual([]);
});

test("approving a club approves each of its men and no other club's, and one with too few starts keeps his label, confirmed", async () => {
  const t = await synced();
  expect(await heldPositions(t, PLAYER.kelleher)).toEqual({ GK: "label?" });

  const approved = await (await asAdmin(t)).mutation(api.positions.playerPositions.approveClub, { clubCode: NEWCASTLE.code });

  expect(approved).toBe(newcastleMen().length);
  expect(await heldPositions(t, PLAYER.barnes)).toEqual({ W: "starts" });
  expect(await heldPositions(t, PLAYER.thiaw)).toEqual({ CB: "starts" });
  expect(await heldPositions(t, PLAYER.hall)).toEqual({ FB: "label" }); // two starts at full back
  expect(await heldPositions(t, PLAYER.kelleher)).toEqual({ GK: "label?" }); // another club's, untouched
});

test("a new signing with no starts plays on his label, unconfirmed until the admin approves him", async () => {
  const t = await synced();
  expect(await heldPositions(t, PLAYER.steur)).toEqual({ CM: "label?" }); // "Centre Central Midfielder"

  await (await asAdmin(t)).mutation(api.positions.playerPositions.approvePlayer, { code: PLAYER.steur });

  expect(await heldPositions(t, PLAYER.steur)).toEqual({ CM: "label" });
});

test("with positions counting at once, starts count unconfirmed and stay in the queue", async () => {
  const t = await synced();

  await (await asAdmin(t)).mutation(api.positions.positionSettings.setApproveMode, { approveMode: "countAtOnce" });

  expect(await heldPositions(t, PLAYER.barnes)).toEqual({ W: "starts?" });
  expect((await (await asAdmin(t)).query(api.positions.playerPositions.ofPlayer, { code: PLAYER.barnes })).proposals).toEqual(["W"]);
});

test("the admin's corrections survive a recount: SS he marks stays, and a position he removes stays off", async () => {
  const t = freshConvex();
  const logged = silenceConsoleError();
  const payloads = recordedPositions();
  const lateNov = payloads.sheets.find((sheet) => sheet.id === SHEET.newcastleLateNov)!;
  payloads.sheets = payloads.sheets.filter((sheet) => sheet !== lateNov);
  payloads.fixtureLists[PL_LAST_COMP_SEASON] = payloads.fixtureLists[PL_LAST_COMP_SEASON].filter((fixture) => fixture.id !== lateNov.id);
  await syncPositionsWith(t, payloads);
  await (await asAdmin(t)).mutation(api.positions.playerPositions.approvePlayer, { code: PLAYER.woltemade });
  await (await asAdmin(t)).mutation(api.positions.playerPositions.setPosition, { code: PLAYER.woltemade, position: "SS" });
  await (await asAdmin(t)).mutation(api.positions.playerPositions.removePosition, { code: PLAYER.woltemade, position: "ST" });

  await syncPositionsWith(t, recordedPositions()); // his fourth start up front arrives

  expect(await heldPositions(t, PLAYER.woltemade)).toEqual({ SS: "admin" });
  expect(logged).toHaveBeenCalledWith(reported());
  expect((await (await asAdmin(t)).query(api.positions.playerPositions.ofPlayer, { code: PLAYER.woltemade })).proposals).toEqual([]);
});

test("a position the admin sets stays until he removes it, and setting it again undoes a removal", async () => {
  const t = await synced();
  await (await asAdmin(t)).mutation(api.positions.playerPositions.approvePlayer, { code: PLAYER.thiaw });

  await (await asAdmin(t)).mutation(api.positions.playerPositions.setPosition, { code: PLAYER.thiaw, position: "FB" });
  expect(await heldPositions(t, PLAYER.thiaw)).toEqual({ CB: "starts", FB: "admin" });

  await (await asAdmin(t)).mutation(api.positions.playerPositions.removePosition, { code: PLAYER.thiaw, position: "FB" });
  expect(await heldPositions(t, PLAYER.thiaw)).toEqual({ CB: "starts" });

  await (await asAdmin(t)).mutation(api.positions.playerPositions.setPosition, { code: PLAYER.thiaw, position: "FB" });
  expect(await heldPositions(t, PLAYER.thiaw)).toEqual({ CB: "starts", FB: "admin" });
});

test("a player no feed has named has no positions until the admin sets one", async () => {
  const t = freshConvex();
  const unknown = 999_999;
  expect(await heldPositions(t, unknown)).toEqual({});

  await (await asAdmin(t)).mutation(api.positions.playerPositions.setPosition, { code: unknown, position: "GK" });

  expect(await heldPositions(t, unknown)).toEqual({ GK: "admin" });
});

describe("the admin's queue (#87)", () => {
  test("#87 Done: a new signing appears with his label, until the admin confirms it", async () => {
    const t = await synced();
    const admin = await asAdmin(t);
    expect((await admin.query(api.positions.playerPositions.queue, {})).newSignings).toContainEqual({
      code: PLAYER.steur,
      name: expect.any(String),
      fullName: expect.any(String),
      clubCode: NEWCASTLE.code,
      label: "Centre Central Midfielder",
    });

    await admin.mutation(api.positions.playerPositions.approvePlayer, { code: PLAYER.steur });

    expect((await admin.query(api.positions.playerPositions.queue, {})).newSignings.map((each) => each.code)).not.toContain(PLAYER.steur);
  });

  test("so is a man with too few starts at any place to have a position from them, who plays on his label", async () => {
    const t = await synced();
    expect((await (await asAdmin(t)).query(api.positions.playerPositions.queue, {})).newSignings).toContainEqual(
      expect.objectContaining({ code: PLAYER.hall, label: "Left Full Back" }),
    );
  });

  test("a man who has left the Premier League is in neither list", async () => {
    const t = await synced();
    await t.run(async (ctx) => {
      for (const code of [PLAYER.steur, PLAYER.barnes]) {
        const player = await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", code)).unique();
        await ctx.db.patch("players", player!._id, { droppedAt: Date.now() });
      }
    });
    const { newSignings, waiting } = await (await asAdmin(t)).query(api.positions.playerPositions.queue, {});
    expect(waiting.map((each) => each.code)).not.toContain(PLAYER.barnes);
    expect(newSignings.map((each) => each.code)).not.toContain(PLAYER.steur);
  });

  test("a man whose starts wait for approval is in it with what they'd give him, until approved", async () => {
    const t = await synced();
    const admin = await asAdmin(t);
    expect((await admin.query(api.positions.playerPositions.queue, {})).waiting).toContainEqual(
      expect.objectContaining({ code: PLAYER.barnes, proposals: ["W"] }),
    );

    await admin.mutation(api.positions.playerPositions.approvePlayer, { code: PLAYER.barnes });

    expect((await admin.query(api.positions.playerPositions.queue, {})).waiting.map((each) => each.code)).not.toContain(PLAYER.barnes);
  });
});

test("everything here is the admin's alone: anyone else signed in is refused", async () => {
  const t = await synced();
  vi.stubEnv("ADMIN_EMAIL", ADMIN);
  const someone = await actingAs(t, "someone@example.com");
  const code = PLAYER.barnes;
  for (const call of [
    () => someone.query(api.positions.playerPositions.ofPlayer, { code }),
    () => someone.query(api.positions.playerPositions.queue, {}),
    () => someone.query(api.positions.playerPositions.find, { text: "Barnes" }),
    () => someone.mutation(api.positions.playerPositions.approvePlayer, { code }),
    () => someone.mutation(api.positions.playerPositions.approveClub, { clubCode: NEWCASTLE.code }),
    () => someone.mutation(api.positions.playerPositions.setPosition, { code, position: "SS" }),
    () => someone.mutation(api.positions.playerPositions.removePosition, { code, position: "W" }),
    () => someone.mutation(api.positions.positionSettings.setApproveMode, { approveMode: "countAtOnce" }),
  ]) {
    await expect(call()).rejects.toThrow(refusals.notAdmin);
  }
  await expect(t.query(api.positions.playerPositions.queue, {})).rejects.toThrow(refusals.signedOut);
  expect(await heldPositions(t, code)).toEqual({ W: "label?" });
});

describe("finding a player to correct (#87)", () => {
  test("by name, with his positions now, never one who has left", async () => {
    const t = await synced();
    const admin = await asAdmin(t);
    await admin.mutation(api.positions.playerPositions.setPosition, { code: PLAYER.kelleher, position: "GK" });
    expect(await admin.query(api.positions.playerPositions.find, { text: "Kelleher" })).toEqual([
      expect.objectContaining({ code: PLAYER.kelleher, fullName: "Caoimhín Kelleher", positions: expect.arrayContaining([{ position: "GK", source: "admin", confirmed: true, flaggedElsewhere: null }]) }),
    ]);
    expect(await admin.query(api.positions.playerPositions.find, { text: "  " })).toEqual([]);

    await t.run(async (ctx) => {
      const player = await ctx.db.query("players").withIndex("by_code", (q) => q.eq("code", PLAYER.kelleher)).unique();
      await ctx.db.patch("players", player!._id, { droppedAt: Date.now() });
    });
    expect(await admin.query(api.positions.playerPositions.find, { text: "Kelleher" })).toEqual([]);
  });

  test("the queue carries the clubs, by name, and how starts count", async () => {
    const t = await synced();
    await t.run(async (ctx) => {
      await ctx.db.insert("clubs", { code: 3, name: "Arsenal", shortName: "ARS" });
      await ctx.db.insert("clubs", { code: 99, name: "Relegated", shortName: "REL", droppedAt: Date.now() });
    });
    const admin = await asAdmin(t);
    expect(await admin.query(api.positions.playerPositions.queue, {})).toMatchObject({
      clubs: [
        { code: 3, name: "Arsenal" },
        { code: BRENTFORD_CODE, name: "Brentford" },
        { code: NEWCASTLE.code, name: "Newcastle" },
      ],
      approveMode: "proposals",
    });
    await admin.mutation(api.positions.positionSettings.setApproveMode, { approveMode: "countAtOnce" });
    expect((await admin.query(api.positions.playerPositions.queue, {})).approveMode).toBe("countAtOnce");
  });
});
