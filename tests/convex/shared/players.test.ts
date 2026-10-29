import { expect, test } from "vitest";
import { clubByCode, clubOf, findClubByCode } from "../../../convex/shared/players";
import { HULL, withHullEverton } from "../../support/convex/matchStats.harness";

// The club reads every module shares (shared/players.ts): one club by its code, found or not, and
// a club's row as a screen names it.

/** A club code no club holds. */
const NO_CLUB = 999_999;

test("a club is found by its code, a code no club holds finds nothing, and clubByCode throws for it", async () => {
  const t = await withHullEverton();
  const found = await t.run(async (ctx) => ({ held: await findClubByCode(ctx, HULL), missing: await findClubByCode(ctx, NO_CLUB) }));
  expect(found.held).toMatchObject({ code: HULL, name: "Hull City" });
  expect(found.missing).toBeNull();
  await expect(t.run((ctx) => clubByCode(ctx, NO_CLUB))).rejects.toThrow(`No club with code ${NO_CLUB} is held`);
});

test("a club as a screen names it is exactly its code, name and short name", async () => {
  const t = await withHullEverton();
  const club = await t.run(async (ctx) => clubOf(await clubByCode(ctx, HULL)));
  expect(club).toStrictEqual({ code: HULL, name: "Hull City", shortName: "HUL" });
});
