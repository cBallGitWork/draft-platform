import { expect, test } from "vitest";
import type { MutationCtx } from "../../../convex/_generated/server";
import { fixtureByCode, gameweekFixtures, GAMEWEEK_MATCHES_MOST } from "../../../convex/shared/fixtures";
import { EVERTON, GAMEWEEK, HULL, HULL_EVERTON, KICKOFF, withHullEverton } from "../../support/convex/matchStats.harness";

// The two fixture reads every module shares (shared/fixtures.ts): one match by its code, and a
// gameweek's current matches under a named cap, each caller saying what an overflow would cut short.

/** Where codes this file makes up start, clear of the recorded ones. */
const MADE_UP_CODES = 900_000;
/** The message's ending a caller passes, as the fixtures screen does. */
const WHY = "they would be cut short";

/** A match Hull play at home to Everton, with `code`, in `gameweek`, dropped at `droppedAt` if given. */
const holdMatch = (ctx: MutationCtx, code: number, gameweek: number | null, droppedAt?: number) =>
  ctx.db.insert("fixtures", { code, gameweek, homeClubCode: HULL, awayClubCode: EVERTON, kickoff: KICKOFF, droppedAt });

test("a match is found by its code, dropped or not, and a code not held finds nothing", async () => {
  const t = await withHullEverton();
  const dropped = MADE_UP_CODES;
  await t.run((ctx) => holdMatch(ctx, dropped, GAMEWEEK, KICKOFF));
  const found = await t.run(async (ctx) => ({
    held: await fixtureByCode(ctx, HULL_EVERTON),
    dropped: await fixtureByCode(ctx, dropped),
    missing: await fixtureByCode(ctx, dropped + 1),
  }));
  expect(found.held).toMatchObject({ code: HULL_EVERTON, gameweek: GAMEWEEK });
  expect(found.dropped).toMatchObject({ code: dropped, droppedAt: KICKOFF });
  expect(found.missing).toBeNull();
});

test("a gameweek's matches are its current ones: dropped ones and other gameweeks' left out", async () => {
  const t = await withHullEverton();
  await t.run(async (ctx) => {
    await holdMatch(ctx, MADE_UP_CODES, GAMEWEEK, KICKOFF);
    await holdMatch(ctx, MADE_UP_CODES + 1, GAMEWEEK + 1);
    await holdMatch(ctx, MADE_UP_CODES + 2, null);
  });
  const codes = await t.run(async (ctx) => (await gameweekFixtures(ctx, GAMEWEEK, WHY)).map((fixture) => fixture.code));
  expect(codes).toEqual([HULL_EVERTON]);
});

test(`a gameweek's matches: ${GAMEWEEK_MATCHES_MOST} are read, one more throws, saying what the caller would cut short`, async () => {
  const t = await withHullEverton();
  const empty = GAMEWEEK + 1;
  const holdTo = (count: number) =>
    t.run(async (ctx) => {
      const held = (await ctx.db.query("fixtures").withIndex("by_gameweek_and_droppedAt", (q) => q.eq("gameweek", empty)).collect()).length;
      for (let index = held; index < count; index += 1) await holdMatch(ctx, MADE_UP_CODES + index, empty);
    });
  const read = () => t.run((ctx) => gameweekFixtures(ctx, empty, WHY));
  await holdTo(GAMEWEEK_MATCHES_MOST);
  expect(await read()).toHaveLength(GAMEWEEK_MATCHES_MOST);
  await holdTo(GAMEWEEK_MATCHES_MOST + 1);
  await expect(read()).rejects.toThrow(`More than ${GAMEWEEK_MATCHES_MOST} matches are held for gameweek ${empty}, so ${WHY}`);
});
