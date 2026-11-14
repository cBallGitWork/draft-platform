import { beforeEach, expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { historyOf } from "../../../convex/rules/rulesHistory";
import { HELD_FIRST_RULES, holdGameweeks, rulesWith } from "../../support/convex/leagueRules.harness";
import { type TestConvex, freshLeague } from "../../support/convex/leagues.harness";
import { clockRunsTo } from "../../support/convex/test.harness";

// #2009 (Part of #1995, the Convex quota): the rules rows saved whole before #1617 are stored once
// as only what each changed, so a rules read stops copying the formations and classics out of
// every old row, and each league's rules read the same in every gameweek after as before.

let t: TestConvex;
let leagueId: Id<"leagues">;
beforeEach(async () => {
  ({ t, leagueId } = await freshLeague({ before: (t) => holdGameweeks(t, { next: 9 }) }));
});

const LATER_WAIVERS = { ...HELD_FIRST_RULES.waivers, runs: [{ day: "wednesday" as const, hour: 11, minute: 30 }] };

const rulesRows = () =>
  t.run((ctx) => ctx.db.query("leagueRules").withIndex("by_leagueId_and_fromGameweek", (q) => q.eq("leagueId", leagueId)).collect());
const history = () => t.run((ctx) => historyOf(ctx, leagueId));
const convert = () => t.mutation(internal.rules.rulesToChanges.convertLeague, { leagueId });

/** Rows as a save stored them before #1617: each the whole rules, from `fromGameweek` on. */
const holdWholeRows = (...rows: { fromGameweek: number; rules: ReturnType<typeof rulesWith> }[]) =>
  t.run(async (ctx) => {
    for (const row of rows) await ctx.db.insert("leagueRules", { leagueId, ...row });
  });

test("old whole rows are stored as only what each changed, and every gameweek's rules read the same", async () => {
  await holdWholeRows(
    { fromGameweek: 3, rules: rulesWith({ waivers: LATER_WAIVERS }) },
    { fromGameweek: 5, rules: rulesWith({ waivers: LATER_WAIVERS, tieBreaks: ["headToHead"] }) },
    { fromGameweek: 7, rules: rulesWith({ waivers: LATER_WAIVERS, tieBreaks: ["headToHead"] }) },
  );
  const before = await history();

  expect(await convert()).toBe(3);

  const rows = await rulesRows();
  expect(rows[0].rules).toBeDefined();
  // The formations, classics and the rest are no longer held again in each later row.
  expect(rows.slice(1).map((row) => [row.rules, row.changes])).toEqual([
    [undefined, { waivers: LATER_WAIVERS }],
    [undefined, { tieBreaks: ["headToHead"] }],
    [undefined, {}],
  ]);
  expect(await history()).toEqual(before);
});

test("a whole row leaving out a part the row before holds stays whole, as a part a row lacks reads as the row before's", async () => {
  const { classics: _classics, ...withoutClassics } = rulesWith({ format: "totalPoints" });
  await holdWholeRows({ fromGameweek: 3, rules: withoutClassics });
  const before = await history();

  expect(await convert()).toBe(0);

  expect((await rulesRows()).at(-1)!.rules).toEqual(withoutClassics);
  expect(await history()).toEqual(before);
});

test("running it again changes nothing", async () => {
  await holdWholeRows({ fromGameweek: 3, rules: rulesWith({ waivers: LATER_WAIVERS }) });
  await convert();
  const once = await rulesRows();

  expect(await convert()).toBe(0);

  expect(await rulesRows()).toEqual(once);
});

test("every league is converted, each in its own transaction", async () => {
  await holdWholeRows({ fromGameweek: 3, rules: rulesWith({ waivers: LATER_WAIVERS }) });

  await t.mutation(internal.rules.rulesToChanges.convertEveryLeague, {});
  await clockRunsTo(t, Date.now());

  expect((await rulesRows()).at(-1)!.changes).toEqual({ waivers: LATER_WAIVERS });
});
