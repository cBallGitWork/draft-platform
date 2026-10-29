import { expect, test } from "vitest";
import { clubByCode, clubOf, findClubByCode, heldPlayerByCode } from "../../../convex/shared/players";
import { HULL, withHullEverton } from "../../support/convex/matchStats.harness";

// The club reads every module shares (shared/players.ts): one club by its code, found or not, and
// a club's row as a screen names it.

/** A club code no club holds. */
const NO_CLUB = 999_999;

/** A player code no player holds. */
const NO_PLAYER = 999_999;

/** A player the test holds. */
const HELD_PLAYER = 7;

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

test("heldPlayerByCode returns the held player, and throws exactly the caller's words for a code the sync doesn't hold", async () => {
  const t = await withHullEverton();
  const { held, found } = await t.run(async (ctx) => {
    const id = await ctx.db.insert("players", { code: HELD_PLAYER, name: "Ndiaye", fullName: "Iliman Ndiaye", clubCode: HULL });
    const held = (await ctx.db.get("players", id))!;
    return { held, found: await heldPlayerByCode(ctx, HELD_PLAYER, "unused") };
  });
  expect(found).toStrictEqual(held);
  const missing = `player ${NO_PLAYER} is nowhere`;
  await expect(t.run((ctx) => heldPlayerByCode(ctx, NO_PLAYER, missing))).rejects.toThrow(new Error(missing));
});
