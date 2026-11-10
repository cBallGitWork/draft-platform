import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { mapFpl } from "../../../convex/football/fpl/fpl";
import { refusals } from "../../../convex/shared/leagueAccess";
import { syncWith } from "../../support/convex/footballSync.harness";
import { actingAs } from "../../support/convex/leagues.harness";
import { asAdmin } from "../../support/convex/positionsSync.harness";
import { PLAYER_CODE, recordedFpl } from "../../support/recorded/fpl.payloads";
import { expectRefused, freshConvex, type TestConvex } from "../../support/convex/test.harness";

// A player's availability (spec/06, Availability): FPL's flag, read through the football sync from
// the recorded bootstrap, which holds five of its six flags, and the admin's over it (spec/15).

const { saka: SAKA, haaland: HAALAND, saliba: SALIBA, sessegnon: SESSEGNON, jesus: JESUS } = PLAYER_CODE;

async function synced(): Promise<TestConvex> {
  const t = freshConvex();
  await syncWith(t, recordedFpl());
  return t;
}

async function availabilityOf(t: TestConvex, code: number) {
  return (await asAdmin(t)).query(api.availability.availability.ofPlayer, { code });
}

test.each([
  ["available (a)", SAKA, "available"],
  ["a doubt (d, 75%)", HAALAND, "doubtful"],
  ["injured (i)", SALIBA, "out"],
  ["suspended (s)", SESSEGNON, "out"],
  ["unavailable (u, gone abroad)", JESUS, "out"],
] as const)("a player FPL flags %s is %s", async (_flag, code, expected) => {
  const t = await synced();

  expect(await availabilityOf(t, code)).toEqual({ availability: expected, feed: expected, set: null });
});

test("a player FPL flags not available (n) is out, as FPL shows it with unavailable's red flag", () => {
  const payloads = recordedFpl();
  const saka = payloads.bootstrap.elements.find((element) => element.code === SAKA)!;
  saka.status = "n";

  expect(mapFpl(payloads.bootstrap, payloads.fixtures).players.find((player) => player.code === SAKA)?.availability).toBe("out");
});

test("a flag FPL has never sent is a changed payload, and refuses the mapping", () => {
  const payloads = recordedFpl();
  payloads.bootstrap.elements[0].status = "x";

  expect(() => mapFpl(payloads.bootstrap, payloads.fixtures)).toThrow('status "x"');
});

test("the admin's setting wins over the feed's, through the next sync, and clearing it brings the feed's back", async () => {
  const t = await synced();
  const admin = await asAdmin(t);

  await admin.mutation(api.availability.availability.set, { code: SALIBA, availability: "available" });
  await syncWith(t, recordedFpl());
  expect(await availabilityOf(t, SALIBA)).toEqual({ availability: "available", feed: "out", set: "available" });

  await admin.mutation(api.availability.availability.set, { code: SALIBA, availability: "doubtful" });
  expect((await availabilityOf(t, SALIBA)).availability).toBe("doubtful");

  await admin.mutation(api.availability.availability.set, { code: SALIBA, availability: null });
  expect(await availabilityOf(t, SALIBA)).toEqual({ availability: "out", feed: "out", set: null });
});

test("the feed's availability moves under the admin's setting, which still wins", async () => {
  const t = await synced();
  await (await asAdmin(t)).mutation(api.availability.availability.set, { code: SAKA, availability: "out" });

  const payloads = recordedFpl();
  payloads.bootstrap.elements.find((element) => element.code === SAKA)!.status = "d";
  await syncWith(t, payloads);

  expect(await availabilityOf(t, SAKA)).toEqual({ availability: "out", feed: "doubtful", set: "out" });
});

test("the Availability tab lists every player set by hand, by name, with his club, positions, the feed's and the admin's", async () => {
  const t = await synced();
  const admin = await asAdmin(t);
  await admin.mutation(api.availability.availability.set, { code: SALIBA, availability: "doubtful" });
  await admin.mutation(api.availability.availability.set, { code: HAALAND, availability: "available" });

  const rows = await admin.query(api.availability.availability.setByHand, {});
  expect(rows.map(({ code, feed, set }) => [code, feed, set])).toEqual([
    [HAALAND, "doubtful", "available"],
    [SALIBA, "out", "doubtful"],
  ]);
  expect(rows[0]).toMatchObject({ name: "Haaland", clubShortName: "MCI" });
  expect(rows[0].positions.length).toBeGreaterThan(0);
  expect(await admin.query(api.availability.availability.forAdmin, { code: SAKA })).toMatchObject({ code: SAKA, name: "Saka", clubShortName: "ARS", feed: "available", set: null });
});

test("clearing a player the admin never set changes nothing", async () => {
  const t = await synced();

  await (await asAdmin(t)).mutation(api.availability.availability.set, { code: HAALAND, availability: null });

  expect(await availabilityOf(t, HAALAND)).toEqual({ availability: "doubtful", feed: "doubtful", set: null });
});

test("a player the football sync doesn't hold has no availability to read or set", async () => {
  const t = await synced();
  const admin = await asAdmin(t);

  await expect(availabilityOf(t, 1)).rejects.toThrow("No player with code 1 is held");
  await expect(admin.mutation(api.availability.availability.set, { code: 1, availability: "out" })).rejects.toThrow("No player with code 1 is held");
});

test("only the admin sets a player's availability", async () => {
  const t = await synced();
  await asAdmin(t);

  await expectRefused((await actingAs(t, "manager@example.com")).mutation(api.availability.availability.set, { code: SAKA, availability: "out" }), refusals.notAdmin);
  expect((await availabilityOf(t, SAKA)).set).toBeNull();
});
