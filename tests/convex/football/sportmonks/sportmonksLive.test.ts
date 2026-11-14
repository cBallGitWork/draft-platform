// The live tick's writes compared before they're made (#2000, part of #1995's database I/O cuts):
// a read that changes nothing writes no match row and no man's stats again. What the tick stores
// and when it fails: sportmonksPlayerStats.test.ts and sportmonksSync.test.ts.

import { expect, test } from "vitest";
import type { DefaultFunctionArgs, RegisteredMutation } from "convex/server";
import { internal } from "../../../../convex/_generated/api";
import type { MutationCtx } from "../../../../convex/_generated/server";
import { sides } from "../../../../convex/football/sportmonks/sportmonks";
import { writeMatch, writePlayerStats } from "../../../../convex/football/sportmonks/sportmonksLive";
import { mapSportmonksMatch } from "../../../../convex/football/sportmonks/sportmonksMatch";
import { halfTimeReached, sportmonksPlayerStats } from "../../../../convex/football/sportmonks/sportmonksPlayerStats";
import { freshConvex, type TestConvex } from "../../../support/convex/test.harness";
import { SM, sportmonksLiveRead } from "../../../support/recorded/sportmonks.payloads";
import { sync, useSportmonks } from "../../../support/convex/sportmonks.harness";

useSportmonks();

const READ_AT = Date.parse("2026-11-14T15:30:00Z");
const MINUTE = 60_000;
const live = internal.football.sportmonks.sportmonksLive;

/** How many rows `mutation` writes when run on `t`'s data with `args`: its handler run on a
 *  database that counts each insert, patch, replace and delete. */
async function writesOf<Args extends DefaultFunctionArgs>(t: TestConvex, mutation: RegisteredMutation<"internal", Args, unknown>, args: Args): Promise<number> {
  // Convex keeps a registered function's handler on it, untyped.
  const { _handler } = mutation as unknown as { _handler: (ctx: MutationCtx, args: Args) => Promise<unknown> };
  const writing = new Set(["insert", "patch", "replace", "delete"]);
  return t.run(async (ctx) => {
    let writes = 0;
    const db = new Proxy(ctx.db, {
      get: (target, field) => {
        if (typeof field === "string" && writing.has(field)) writes += 1;
        const value: unknown = Reflect.get(target, field);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await _handler({ ...ctx, db }, args);
    return writes;
  });
}

test("a live read that changes nothing writes no match row and no man's stats again; one that does writes only what it changed", async () => {
  const t = freshConvex();
  await sync(t);
  const raw = sportmonksLiveRead().data[0];
  const { score, men, events } = mapSportmonksMatch(raw);
  const { home, away } = sides(raw);
  const records = sportmonksPlayerStats({ score, homeTeamId: home, awayTeamId: away, halfTime: halfTimeReached(raw.state_id), men, events });
  await t.mutation(live.writeMatch, { score, men, events, readAt: READ_AT });
  await t.mutation(live.writePlayerStats, { fixtureCode: SM.oldFirm, records });

  // The same read a minute on: the score, the match row and every man's stats left as they were.
  expect(await writesOf(t, writeMatch, { score, men, events, readAt: READ_AT + MINUTE })).toBe(0);
  expect(await writesOf(t, writePlayerStats, { fixtureCode: SM.oldFirm, records })).toBe(0);
  const [match] = await t.run((ctx) => ctx.db.query("sportmonksMatches").collect());
  expect(match.readAt).toBe(READ_AT);

  // One man's stats moved: his row alone is written. An event gone: the match row is rewritten.
  const moved = records.map((record, index) => (index === 0 ? { ...record, played: !record.played } : record));
  expect(await writesOf(t, writePlayerStats, { fixtureCode: SM.oldFirm, records: moved })).toBe(1);
  expect(await writesOf(t, writeMatch, { score, men, events: events.slice(1), readAt: READ_AT + 2 * MINUTE })).toBe(1);
  const [rewritten] = await t.run((ctx) => ctx.db.query("sportmonksMatches").collect());
  expect(rewritten).toMatchObject({ events: events.slice(1), readAt: READ_AT + 2 * MINUTE });
});
