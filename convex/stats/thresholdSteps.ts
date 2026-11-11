import type { Doc } from "../_generated/dataModel";
import type { StoredStep } from "../matchup/vidiprinter";
import type { SideMatchOutcome } from "../admin/sideRuns";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { ALL_CELLS, type Cell } from "../lineup/pitch";
import { withOwnStats } from "../scoring/ownStats";
import { rulePointsIn } from "../scoring/scoring";
import { ANY_BACK_LINE, rulesAt, withBackLine, type TeamScoring } from "../scoring/teamScoring";
import { inTenths, statIn, type MatchStats } from "../scoring/values";
import { checkedOnce, type ScoringRule, type ScoringSet } from "../scoring/scoringSet";
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
// the site's set in force that gameweek, so the step is stored for every man, owned or not; and so
// is every move of a stat some role or team instruction in that set adjusts, as whether his role
// or his team's instructions move it is the matchup's to work out too (#868, #990). A read at full time stores none: its records are the sync's
// (matchStats.ts), and the live reads have shown the match by then.

type PlayerCode = number;

/** One man's total of one stat moving his points under some slot's pricing, as a read showed it.
 *  `from` and `to` are equal where only his minutes moved: they passed a rule's minimum, as a
 *  clean sheet's (stepPoints). */
interface ThresholdStep {
  stat: string;
  from: number;
  to: number;
}

/** The most steps one match held a row a step, as stored before #871 (thresholdSteps): enough for
 *  the first set, about 260 a busy match measured (thresholdSteps.test.ts). Those rows are only
 *  read now. More throws, never a silent cut. Claude's choice. */
export const THRESHOLD_STEPS_MOST = 1000;

/** The most steps one row holds: well under Convex's 8192 values an array, which a read pricing
 *  every catalogue stat for 40 men would pass. A read showing more takes more rows. */
export const THRESHOLD_STEPS_A_ROW = 1000;

/** The most rows of steps one match holds (#871). A row is a live read's, and the live tick reads a
 *  match once a minute for at most LIVE_WINDOW_MS (4 hours, shared/dueMatches.ts) from kick-off: 240 reads,
 *  and only one that showed a step stores a row. Doubled for runs by hand and a read past
 *  THRESHOLD_STEPS_A_ROW. Measured over the recorded team stats (thresholdSteps.test.ts): a busy
 *  match's steps under the roles' first values, about 3,550, fit these rows, and a double
 *  gameweek's twenty matches stay far under Convex's read limits in one query. More throws, never a
 *  silent cut: the matchup then says its commentary can't be read, and logs why, while its scores
 *  still show. Claude's choice. */
export const THRESHOLD_STEP_READS_MOST = 500;

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

/** Each stat whose points from `before` to `after` change, up or down, at some cell or in some
 *  role: one step a stat, however many rules price it. A role scores by bars of a weighed count
 *  (scoring.ts) and a team instruction by each whole `every` (teamScoring.ts), neither of which a
 *  single cell's rule pricing can see, so any move in the count of a stat some role or team
 *  instruction in the set adjusts is a step, stored and priced on read, though no rule prices it
 *  or its rule's minimum minutes aren't yet met (#868, #990). His minutes are judged as each read shows them, so a clean sheet he now has the minutes for is a
 *  step though its count stayed 1. A step whose count stayed put while his minutes fell (a feed's
 *  correction) isn't stored: priced on read, it would show the wrong way round. */
export function thresholdSteps(before: MatchStats, after: MatchStats, set: ScoringSet): ThresholdStep[] {
  const was = withOwnStats(before, set);
  const now = withOwnStats(after, set);
  const minutesWere = statIn(was, MINUTES_STAT);
  const minutesNow = statIn(now, MINUTES_STAT);
  const byStat = rulesByStat(set);
  const adjusted = adjustedStats(set);
  const steps: ThresholdStep[] = [];
  for (const stat of new Set([...byStat.keys(), ...adjusted])) {
    if (ON_THEIR_OWN_LINES.has(stat)) continue;
    const rules = byStat.get(stat) ?? [];
    const from = statIn(was, stat);
    const to = statIn(now, stat);
    if (from === to && minutesNow < minutesWere) continue;
    const adjustedMoves = from !== to && adjusted.has(stat);
    // A back line reprices a clean sheet and each goal conceded (teamScoring.ts), so a goal
    // conceded the set's own rule leaves unpriced is a step too (#1754).
    const pricings = [rules, rules.map((rule) => withBackLine(rule, ANY_BACK_LINE))];
    const moves = (priced: readonly ScoringRule[]) => ALL_CELLS.some((cell) => statPoints(priced, cell, from, minutesWere) !== statPoints(priced, cell, to, minutesNow));
    if (adjustedMoves || pricings.some(moves)) {
      steps.push({ stat, from, to });
    }
  }
  return steps;
}

/** Every stat some role in the set scores, on either side, and every stat some team instruction
 *  scores (#990: an instruction's move gets its live line as a role's does). */
function adjustedStats(set: ScoringSet): Set<string> {
  const roleStats = (set.roles ?? []).flatMap(({ bonus, cost }) => [...bonus.parts, ...cost.parts].map(({ stat }) => stat));
  const instructionStats = (set.instructions ?? []).flatMap(({ lines }) => lines.flatMap(({ stats }) => stats.map(({ stat }) => stat)));
  return new Set([...roleStats, ...instructionStats]);
}

/** What a stored step is worth at `cell` under the rules for its stat, as `team`'s back line
 *  prices them there, before any role: what its line shows (vidiprinter.ts). Both totals are priced
 *  at his minutes then, but the before of one whose total didn't move, which was stored because his
 *  minutes passed a rule's minimum. `team` is undefined for a man in no lineup. */
export function stepPoints(
  step: Pick<Doc<"thresholdSteps">, "stat" | "from" | "to" | "minutes">,
  set: ScoringSet,
  cell: Cell,
  team: TeamScoring | undefined,
): number {
  const rules = rulesAt(set.rules, team, cell.area).filter((rule) => rule.stat === step.stat);
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
 *  Only a whole record counts, as only it is scored. The read's steps go in as few rows as hold
 *  them, none when it showed none (#871). */
export async function storeThresholdSteps(
  ctx: MutationCtx,
  fixtureCode: number,
  minute: number | null,
  records: readonly PlayerMatchRecord[],
  held: ReadonlyMap<PlayerCode, Doc<"playerMatchStats">>,
): Promise<SideMatchOutcome> {
  let steps: Doc<"thresholdStepReads">["steps"];
  try {
    const fixture = await fixtureByCode(ctx, fixtureCode);
    // A match not held, or with no gameweek, has no set to price by; the records' own write says so.
    if (fixture === null || fixture.gameweek === null) return { fixtureCode, ok: true };
    const set = await siteScoringInGameweek(ctx, fixture.gameweek);
    checkedOnce(set);
    steps = records
      .filter((record) => isWhole(record))
      .flatMap((record) =>
        thresholdSteps(held.get(record.playerCode)?.stats ?? {}, record.stats, set).map((step) => ({
          playerCode: record.playerCode,
          ...step,
          minutes: statIn(record.stats, MINUTES_STAT),
        })),
      );
  } catch (error) {
    return { fixtureCode, ok: false, error: logFailure(`match ${fixtureCode}'s threshold steps weren't stored`, error) };
  }
  for (let start = 0; start < steps.length; start += THRESHOLD_STEPS_A_ROW) {
    await ctx.db.insert("thresholdStepReads", { fixtureCode, minute, steps: steps.slice(start, start + THRESHOLD_STEPS_A_ROW) });
  }
  return { fixtureCode, ok: true };
}

/** One match's stored steps, oldest first: those stored a row a step before #871, then the reads'. */
export async function thresholdStepsOf(ctx: QueryCtx, fixtureCode: number): Promise<StoredStep[]> {
  const before = await takeAllOrThrow(
    ctx.db.query("thresholdSteps").withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", fixtureCode)),
    THRESHOLD_STEPS_MOST,
    `Match ${fixtureCode} holds more than ${THRESHOLD_STEPS_MOST} threshold steps, so some would be left out`,
  );
  const reads = await takeAllOrThrow(
    ctx.db.query("thresholdStepReads").withIndex("by_fixtureCode", (q) => q.eq("fixtureCode", fixtureCode)),
    THRESHOLD_STEP_READS_MOST,
    `Match ${fixtureCode} holds more than ${THRESHOLD_STEP_READS_MOST} reads' threshold steps, so some would be left out`,
  );
  return [...before, ...reads.flatMap(({ minute, steps }) => steps.map((step) => ({ ...step, minute })))];
}
