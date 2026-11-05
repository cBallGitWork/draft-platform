import { expect, test } from "vitest";
import { internal } from "../../../convex/_generated/api";
import { PAST_ROWS_ADDED_MOST, PAST_ROWS_CLEARED } from "../../../convex/pastSeasons/pastSeasonLimits";
import { SAMPLE_SEASON, sampleRows } from "../../support/convex/pastSeason.harness";
import { freshConvex } from "../../support/convex/test.harness";

const load = internal.pastSeasons.pastSeasonLoad;
const storedRows = (t: ReturnType<typeof freshConvex>) =>
  t.run(async (ctx) => (await ctx.db.query("pastPlayerMatchStats").collect()).map(({ _id, _creationTime, ...row }) => row));

test("the sample's rows load as the copy made them", async () => {
  const t = freshConvex();
  expect(await t.mutation(load.addRows, { rows: sampleRows() })).toBe(9);
  expect(await storedRows(t)).toEqual(sampleRows());
});

test("clearing a season deletes only its rows, a page at a time, saying when more are left", async () => {
  const t = freshConvex();
  const row = sampleRows()[0];
  await t.run(async (ctx) => {
    for (let index = 0; index < PAST_ROWS_CLEARED + 1; index++) await ctx.db.insert("pastPlayerMatchStats", row);
    await ctx.db.insert("pastPlayerMatchStats", { ...row, season: SAMPLE_SEASON - 1 });
  });
  expect(await t.mutation(load.clearSeason, { season: SAMPLE_SEASON })).toEqual({ deleted: PAST_ROWS_CLEARED, more: true });
  expect(await t.mutation(load.clearSeason, { season: SAMPLE_SEASON })).toEqual({ deleted: 1, more: false });
  expect((await storedRows(t)).map((each) => each.season)).toEqual([SAMPLE_SEASON - 1]);
});

test("a batch over the most one call adds is refused whole", async () => {
  const t = freshConvex();
  const rows = Array.from({ length: PAST_ROWS_ADDED_MOST + 1 }, () => sampleRows()[0]);
  await expect(t.mutation(load.addRows, { rows })).rejects.toThrow(`A batch of ${PAST_ROWS_ADDED_MOST + 1} rows is over the ${PAST_ROWS_ADDED_MOST} one call adds`);
  expect(await storedRows(t)).toEqual([]);
});
