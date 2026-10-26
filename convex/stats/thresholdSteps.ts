import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { AREAS, cellsOf, LANES, type Cell } from "../lineup/pitch";
import { withOwnStats } from "../scoring/ownStats";
import { rulePointsIn, statIn, type MatchStats } from "../scoring/scoring";
import { validateScoringSet, type ScoringSet } from "../scoring/scoringSet";
import { siteScoringInGameweek } from "../scoring/siteScoring";
import { takeAllOrThrow } from "../shared/cappedRead";
import { logFailure } from "../shared/errors";
import { isWhole, MINUTES_STAT, type PlayerMatchRecord } from "./matchRecords";

// The threshold lines' moments (spec/10, The commentary; #44): "~58' Rice: 3 key passes, +1". A
// rule paying per number of actions or by bands pays at points a running total reaches, and only
// the live reads see when: each read that shows a man's total pass such a point under any slot's
// pricing stores a step, with the match clock then (the "~": when the totals showed it, not when
// it happened). Which slot he stands in, and so what the step pays, is each matchup's to work out
// on read (matchup/vidiprinter.ts), under the site's set in force that gameweek, so the step is
// stored for every man, owned or not. A read at full time stores none: its records are the
// sync's (matchStats.ts), and the live reads have shown the match by then.

type PlayerCode = number;

/** One man's total of one stat passing a point a rule pays, as a read showed it. */
export interface ThresholdStep {
  stat: string;
  from: number;
  to: number;
}

/** The most steps one match holds. Under the first set it is about 60 (every man's minutes past 1
 *  and 60, and the defence's goals conceded); more throws, never a silent cut. Claude's choice. */
export const THRESHOLD_STEPS_MOST = 1000;

/** Every cell a man can be priced at. */
const EVERY_CELL: readonly Cell[] = AREAS.flatMap((area) => cellsOf(area, LANES));

/** Minutes past any rule's minimum: whether a total passes a point is judged apart from them, and
 *  the matchup prices the step with his minutes then. */
const ANY_MINUTES = Number.POSITIVE_INFINITY;

/** Each stat whose total rose from `before` to `after` past a point some cell's pricing of a
 *  per-number or bands rule pays: one step a stat, however many rules price it. */
export function thresholdSteps(before: MatchStats, after: MatchStats, set: ScoringSet): ThresholdStep[] {
  const was = withOwnStats(before, set);
  const now = withOwnStats(after, set);
  const steps = new Map<string, ThresholdStep>();
  for (const rule of set.rules) {
    if (rule.shape === "perAction" || steps.has(rule.stat)) continue;
    const from = statIn(was, rule.stat);
    const to = statIn(now, rule.stat);
    const pays = (actions: number, cell: Cell) => rulePointsIn(rule, cell, actions, ANY_MINUTES);
    if (to > from && EVERY_CELL.some((cell) => pays(to, cell) !== pays(from, cell))) steps.set(rule.stat, { stat: rule.stat, from, to });
  }
  return [...steps.values()];
}

/** The steps a live read's `records` show over the `held` rows, stored with the clock's `minute`.
 *  Never throws: a set that can't be read is logged and stores no steps, so it never stops the
 *  records being written. Only a whole record counts, as only it is scored. */
export async function storeThresholdSteps(
  ctx: MutationCtx,
  fixtureCode: number,
  minute: number | null,
  records: readonly PlayerMatchRecord[],
  held: ReadonlyMap<PlayerCode, Doc<"playerMatchStats">>,
): Promise<void> {
  let rows: Omit<Doc<"thresholdSteps">, "_id" | "_creationTime">[];
  try {
    const fixture = await ctx.db
      .query("fixtures")
      .withIndex("by_code", (q) => q.eq("code", fixtureCode))
      .unique();
    // A match not held, or with no gameweek, has no set to price by; the records' own write says so.
    if (fixture === null || fixture.gameweek === null) return;
    const set = await siteScoringInGameweek(ctx, fixture.gameweek);
    validateScoringSet(set);
    rows = records
      .filter((record) => isWhole(record))
      .flatMap((record) =>
        thresholdSteps(held.get(record.playerCode)?.stats ?? {}, record.stats, set).map((step) => ({
          fixtureCode,
          playerCode: record.playerCode,
          ...step,
          minutes: statIn(record.stats, MINUTES_STAT),
          minute,
        })),
      );
  } catch (error) {
    logFailure(`match ${fixtureCode}'s threshold steps weren't stored`, error);
    return;
  }
  for (const row of rows) await ctx.db.insert("thresholdSteps", row);
}

/** One match's stored steps, oldest first. */
export function thresholdStepsOf(ctx: QueryCtx, fixtureCode: number): Promise<Doc<"thresholdSteps">[]> {
  return takeAllOrThrow(
    ctx.db.query("thresholdSteps").withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", fixtureCode)),
    THRESHOLD_STEPS_MOST,
    `Match ${fixtureCode} holds more than ${THRESHOLD_STEPS_MOST} threshold steps, so some would be left out`,
  );
}
