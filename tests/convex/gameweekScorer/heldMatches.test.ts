import { expect, test } from "vitest";
import { MATCH_RECORDS_MOST, matchRecordsOf } from "../../../convex/gameweekScorer/heldMatches";
import { freshConvex, ROWS_TO_THE_CAP } from "../../support/convex/test.harness";

// matchRecordsOf: a match's records read whole up to MATCH_RECORDS_MOST, and past it a throw that
// says what would be cut short. The scorer's message ("its points") is pinned in scoringCaps.test.ts;
// this pins the match page's ("its men").

const FIXTURE = 700_001;
/** Where this file's made-up player codes start. */
const MADE_UP_CODES = 900_000;
const WHY = "its men";

test(`a match's records: ${MATCH_RECORDS_MOST} are read, one more throws saying what would be cut short`, ROWS_TO_THE_CAP, async () => {
  const t = freshConvex();
  const holdTo = (count: number, from: number) =>
    t.run(async (ctx) => {
      for (let index = from; index < count; index += 1) {
        await ctx.db.insert("playerMatchStats", {
          playerCode: MADE_UP_CODES + index,
          fixtureCode: FIXTURE,
          started: false,
          played: false,
          arrived: { fpl: true, pl: true },
          stats: {},
          state: "provisional",
        });
      }
    });
  const read = () => t.run((ctx) => matchRecordsOf(ctx, FIXTURE, WHY));

  await holdTo(MATCH_RECORDS_MOST, 0);
  expect(await read()).toHaveLength(MATCH_RECORDS_MOST);
  await holdTo(MATCH_RECORDS_MOST + 1, MATCH_RECORDS_MOST);
  await expect(read()).rejects.toThrow(`Match ${FIXTURE} holds more than ${MATCH_RECORDS_MOST} records, so its men would be cut short`);
});
