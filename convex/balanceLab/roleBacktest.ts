import { takesRole } from "../lineup/roles";
import type { SlotPosition } from "../lineup/pitch";
import type { Position } from "../positions/positionTables";
import { roleTotal, scoredRecord } from "../scoring/scoring";
import type { ScoringSet } from "../scoring/scoringSet";
import { weighedCount } from "../scoring/values";
import { ROLE_TARGET_MARGIN } from "./balanceLabLimits";
import { averageOf, balanceLab, isOffTarget, roleStats, startsBySlot, testedStarts, type PastStart, type TakesRole } from "./balanceLab";
import type { LabRole } from "./labReportShape";

// The redrawn roles' backtest (#1446; spec/05 Roles): each role the site's set scores, over every
// past season's real starts in its slot (S05.33), against its slot's target, passing within
// ROLE_TARGET_MARGIN (S05.10). The rule balance lab's own count (balanceLab.ts) with one difference,
// Craig's answers on #1446 (13 Nov 2026): every past start counts, matched to Sportmonks or not, but a
// matched man's start counts for a role only if his Sportmonks positions may take it (S05.29); an
// unmatched man's counts for every role in his slot. A role that fails gets bonus bars refitted
// until it lands within the margin, for a session Craig watches to put in a patch, old against new
// (Craig, 17 Nov 2026, on #1446). Pure: run on dev by roleBacktestRun.ts.

/** Each past man matched to his Sportmonks player, by his FPL code: his Sportmonks positions. */
export type MatchedPositions = ReadonlyMap<number, readonly Position[]>;

/** Whether a past man may take a role: one matched, by his Sportmonks positions; one unmatched (no
 *  FPL code, or no Sportmonks player for it), every role in his slot. */
export const takesByPositions =
  (matched: MatchedPositions): TakesRole =>
  (player, role) =>
    typeof player !== "number" || takesRole(matched.get(player) ?? [], role);

/** A failing role's bonus bars, old and refitted, with the average they give; `bars` null where no
 *  bars land it within the margin. */
export interface Refit {
  role: string;
  slot: string;
  old: readonly number[];
  bars: number[] | null;
  average: number | null;
}

export interface Backtest {
  roles: LabRole[];
  refits: Refit[];
}

/** The steps a refitted bar is drawn in, so a bar stays a count a manager can read. */
const BAR_STEP = 0.5;
/** How far the refit scales a role's bonus bars, each way, and by how much a try. */
const SCALE_MOST = 10;
const SCALE_STEP = 1.02;

/** The points a side's bars give a count: one for each it reaches. */
const reached = (bars: readonly number[], count: number): number => bars.filter((bar) => count >= bar).length;

/** Bonus bars for `role` that land its average over `tested` closest to `target`: its own bars
 *  scaled up or down, each to the nearest BAR_STEP, kept rising. The cost is left as it is. */
export function refitBonusBars(set: ScoringSet, role: string, tested: readonly PastStart[], target: number): { bars: number[]; average: number } | null {
  const scoring = set.roles?.find((each) => each.role === role);
  if (scoring === undefined || tested.length === 0) return null;
  const { parts, bars: old } = scoring.bonus;
  const counted = tested.map(({ stats }) => {
    const count = weighedCount(scoredRecord(stats, set), parts);
    return { count, rest: roleTotal(stats, set, role) - reached(old, count) };
  });
  let best: { bars: number[]; average: number } | null = null;
  for (let scale = 1 / SCALE_MOST; scale <= SCALE_MOST; scale *= SCALE_STEP) {
    const bars = old.map((bar) => Math.max(BAR_STEP, Math.round((bar * scale) / BAR_STEP) * BAR_STEP));
    if (bars.some((bar, at) => at > 0 && bar <= bars[at - 1]!)) continue;
    const average = averageOf(
      counted.reduce((sum, { count, rest }) => sum + reached(bars, count) + rest, 0),
      counted.length,
    )!;
    if (best === null || Math.abs(average - target) < Math.abs(best.average - target)) best = { bars, average };
  }
  return best;
}

/** The backtest of `set` over the past starts, with `matched` men's Sportmonks positions. */
export function roleBacktest(set: ScoringSet, starts: readonly PastStart[], matched: MatchedPositions): Backtest {
  const takes = takesByPositions(matched);
  const { roles } = balanceLab(set, starts, takes);
  const { bySlot } = startsBySlot(starts);
  const refits = roles.flatMap((each): Refit[] => {
    if (!("offTarget" in each) || !each.offTarget) return [];
    const { role, slot, target } = each;
    const tested = testedStarts(bySlot.get(slot as SlotPosition) ?? [], roleStats(set, role), role, takes);
    const old = set.roles!.find((scoring) => scoring.role === role)!.bonus.bars;
    const fit = refitBonusBars(set, role, tested, target);
    const landed = fit !== null && !isOffTarget(fit.average, target);
    return [{ role, slot, old, bars: landed ? fit.bars : null, average: fit?.average ?? null }];
  });
  return { roles, refits };
}

/** One role's line: its starts, average, target and pass or fail, or not tested and why. */
function roleLine(role: LabRole): string {
  const named = `${role.slot} ${role.role}`;
  if ("missing" in role) return `${named}: not tested, the past seasons have no ${role.missing.join(", ")}`;
  if (role.average === null) return `${named}: not tested, no past start`;
  return `${named}: ${role.starts} starts, average ${role.average}, target ${role.target}, ${role.offTarget ? "fail" : "pass"}`;
}

/** A failing role's refit, old against new. */
function refitLine({ role, slot, old, bars, average }: Refit): string {
  const was = `${slot} ${role}: bonus bars ${old.join(", ")}`;
  if (bars === null) return `${was}: no bars land it within ${ROLE_TARGET_MARGIN} (closest average ${average})`;
  return `${was} → ${bars.join(", ")}, average ${average}`;
}

/** What the one command prints: every role, then each failing role's refit. */
export const backtestLines = ({ roles, refits }: Backtest): string[] => [
  ...roles.map(roleLine),
  ...(refits.length === 0 ? [] : ["Refitted, old → new:", ...refits.map(refitLine)]),
];

/** One tested role's average in the committed averages file. */
export interface RoleAverage {
  role: string;
  slot: string;
  target: number;
  starts: number;
  average: number;
}

/** The averages file's rows: each role with an average, which its CI test holds within the margin. */
export const roleAverages = (roles: readonly LabRole[]): RoleAverage[] =>
  roles.flatMap((each) => ("missing" in each || each.average === null ? [] : [{ role: each.role, slot: each.slot, target: each.target, starts: each.starts, average: each.average }]));
