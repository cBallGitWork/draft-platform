import type { Doc } from "../_generated/dataModel";
import type { SideMatchOutcome } from "../admin/sideRuns";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { ALL_CELLS, type Cell } from "../lineup/pitch";
import { withOwnStats } from "../scoring/ownStats";
import { rulePointsIn } from "../scoring/scoring";
import { inTenths, statIn, type MatchStats } from "../scoring/values";
import { validateScoringSet, type ScoringRule, type ScoringSet } from "../scoring/scoringSet";
import { siteScoringInGameweek } from "../scoring/siteVersions";
import { takeAllOrThrow } from "../shared/cappedRead";
import { logFailure } from "../shared/errors";
import { fixtureByCode } from "../shared/fixtures";
import { EVENT_STATS, isWhole, MINUTES_STAT, type PlayerMatchRecord } from "./matchRecords";

// The threshold lines' moments (spec/10, The commentary; #44, #835): "~58' Rice: 3 key passes,
// +1". Every point movement, up or down, gets a line (Craig, 31 Oct 2026), and only the live reads
// see when a running total moved a player's points: each read that shows a stat's points change
// under any slot's pricing stores a step, with the match clock then (the "~": when the totals
// showed it, not when it happened). That takes in a minutes band but the first, which his
// kick-off or coming-on line already says; a clean sheet added once he has the minutes for it and
// taken away by the goal that ends it; and goals conceded. A goal, an assist, a card or an own goal
// has its own line, priced there (EVENT_STATS), so never a step. Which slot he stands in, and so
// what the step is worth, is each matchup's to work out on read (matchup/vidiprinter.ts), under
// the site's set in force that gameweek, so the step is stored for every man, owned or not. A read
// at full time stores none: its records are the sync's (matchStats.ts), and the live reads have
// shown the match by then.

type PlayerCode = number;

/** One man's total of one stat moving his points under some slot's pricing, as a read showed it.
 *  `from` and `to` are equal where only his minutes moved: they passed a rule's minimum, as a
 *  clean sheet's (stepPoints). */
export interface ThresholdStep {
  stat: string;
  from: number;
  to: number;
}

/** The most steps one match holds. Under the first set, by count of its rules, not measured: each
 *  of about 32 men who play makes at most 1 for his minutes (past 60), about 3 for a clean sheet
 *  (added, taken away, and back if VAR rules the goal out), 1 for each 2 goals conceded each way,
 *  1 for his defensive contribution and 1 for each 3 saves or each penalty; about 8 a man with a
 *  few goals, so about 250 a match. More throws, never a silent cut: the matchup then says its
 *  commentary can't be read, and logs why, while its scores still show. Claude's choice. */
export const THRESHOLD_STEPS_MOST = 1000;

/** The stats a goal, an assist, a card or an own goal moves: their own lines price them
 *  (vidiprinter.ts), so a step would show the move twice. */
const ON_THEIR_OWN_LINES: ReadonlySet<string> = new Set(Object.values(EVENT_STATS));

/** The minutes his kick-off or coming-on line says he has played: his minutes are priced from no
 *  fewer, so the first band (a point for playing, under the first set) has no line of its own. */
const CAME_ON_MINUTES = 1;

/** No minutes at all: what a step whose total didn't move is priced from, as its rule's minimum
 *  was then unmet. */
const NO_MINUTES = 0;

/** His total of `stat` as its points are worked out from: his minutes never below his coming on. */
const counted = (stat: string, actions: number) => (stat === MINUTES_STAT ? Math.max(actions, CAME_ON_MINUTES) : actions);

/** The points `rules`, all of one stat, give at `cell` for `actions` of it and `minutes` played. */
function statPoints(rules: readonly ScoringRule[], cell: Cell, actions: number, minutes: number): number {
  return rules.reduce((total, rule) => total + rulePointsIn(rule, cell, counted(rule.stat, actions), minutes), 0);
}

/** Each stat whose points from `before` to `after` change, up or down, at some cell: one step a
 *  stat, however many rules price it. His minutes are judged as each read shows them, so a clean
 *  sheet he now has the minutes for is a step though its count stayed 1. A step whose count stayed
 *  put while his minutes fell (a feed's correction) isn't stored: priced on read, it would show
 *  the wrong way round. */
export function thresholdSteps(before: MatchStats, after: MatchStats, set: ScoringSet): ThresholdStep[] {
  const was = withOwnStats(before, set);
  const now = withOwnStats(after, set);
  const minutesWere = statIn(was, MINUTES_STAT);
  const minutesNow = statIn(now, MINUTES_STAT);
  const steps: ThresholdStep[] = [];
  for (const [stat, rules] of rulesByStat(set)) {
    if (ON_THEIR_OWN_LINES.has(stat)) continue;
    const from = statIn(was, stat);
    const to = statIn(now, stat);
    if (from === to && minutesNow < minutesWere) continue;
    if (ALL_CELLS.some((cell) => statPoints(rules, cell, from, minutesWere) !== statPoints(rules, cell, to, minutesNow))) steps.push({ stat, from, to });
  }
  return steps;
}

/** What a stored step is worth at `cell` under the rules for its stat, before any role: what its
 *  line shows (vidiprinter.ts). Both totals are priced at his minutes then, but the before of one
 *  whose total didn't move, which was stored because his minutes passed a rule's minimum. */
export function stepPoints(step: Pick<Doc<"thresholdSteps">, "stat" | "from" | "to" | "minutes">, set: ScoringSet, cell: Cell): number {
  const rules = set.rules.filter((rule) => rule.stat === step.stat);
  const minutesBefore = step.from === step.to ? NO_MINUTES : step.minutes;
  return inTenths(statPoints(rules, cell, step.to, step.minutes) - statPoints(rules, cell, step.from, minutesBefore));
}

/** The set's rules, by the stat each prices, in the set's order. */
function rulesByStat(set: ScoringSet): Map<string, ScoringRule[]> {
  const byStat = new Map<string, ScoringRule[]>();
  for (const rule of set.rules) byStat.set(rule.stat, [...(byStat.get(rule.stat) ?? []), rule]);
  return byStat;
}

/** The steps a live read's `records` show over the `held` rows, stored with the clock's `minute`,
 *  and how it went. Never throws: a set that can't be read is logged, stores no steps and is handed
 *  back for the threshold lines feed's row (#522), so it never stops the records being written.
 *  Only a whole record counts, as only it is scored. */
export async function storeThresholdSteps(
  ctx: MutationCtx,
  fixtureCode: number,
  minute: number | null,
  records: readonly PlayerMatchRecord[],
  held: ReadonlyMap<PlayerCode, Doc<"playerMatchStats">>,
): Promise<SideMatchOutcome> {
  let rows: Omit<Doc<"thresholdSteps">, "_id" | "_creationTime">[];
  try {
    const fixture = await fixtureByCode(ctx, fixtureCode);
    // A match not held, or with no gameweek, has no set to price by; the records' own write says so.
    if (fixture === null || fixture.gameweek === null) return { fixtureCode, ok: true };
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
    return { fixtureCode, ok: false, error: logFailure(`match ${fixtureCode}'s threshold steps weren't stored`, error) };
  }
  for (const row of rows) await ctx.db.insert("thresholdSteps", row);
  return { fixtureCode, ok: true };
}

/** One match's stored steps, oldest first. */
export function thresholdStepsOf(ctx: QueryCtx, fixtureCode: number): Promise<Doc<"thresholdSteps">[]> {
  return takeAllOrThrow(
    ctx.db.query("thresholdSteps").withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", fixtureCode)),
    THRESHOLD_STEPS_MOST,
    `Match ${fixtureCode} holds more than ${THRESHOLD_STEPS_MOST} threshold steps, so some would be left out`,
  );
}
