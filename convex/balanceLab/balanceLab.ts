import type { SlotPosition } from "../lineup/pitch";
import { DEFAULT_ROLES } from "../lineup/roles";
import { PAST_STAT_COLUMNS } from "../pastSeasons/pastStatColumns";
import { roleTotal } from "../scoring/scoring";
import type { ScoringSet } from "../scoring/scoringSet";
import { ROLE_TARGET_MARGIN } from "./balanceLabLimits";
import type { LabReport, LabRole } from "./labReportShape";

// The rule balance lab (spec/14, The rule balance lab; #843): a backtest of a patch draft on the
// past seasons' real starts, "just to make sure a change is good". Pure: it saves nothing, so
// locked gameweeks keep their scores. Craig's answers on #843 (6 and 7 Nov 2026) settle it:
// - each role's average a start over its slot's real starts, against the slot's target role bonus
//   (spec/05 Roles), flagged more than ROLE_TARGET_MARGIN off it;
// - a past start counts in the slot his position in that match's starting line-up maps to, never
//   his FPL position; a start whose position maps to none is left out, and counted as skipped;
// - a role scoring a stat the past seasons weren't copied with (pastStatColumns.ts) is "not
//   tested", naming those stats, with no average and no flag;
// - a copied stat blank in one match leaves that match out of the role's average only (Craig,
//   6 Nov 2026, on #842), and the starts it was tested on are shown;
// - no biggest movers and no what-ifs on this season's results ("Drop what ifs").
// Team instructions are checked here once the site's set holds them: today it holds none.

/** Each slot's target role bonus a start (spec/05 Roles: half its gap in base points to strikers,
 *  plus 0.5 for every slot; Craig, 4 Nov 2026). */
export const ROLE_TARGETS: Readonly<Record<SlotPosition, number>> = {
  ST: 0.5,
  W: 0.6,
  CAM: 0.6,
  WM: 0.8,
  GK: 0.9,
  WB: 1.0,
  CM: 1.0,
  FB: 1.1,
  CDM: 1.1,
  CB: 1.2,
};

/** Where the past seasons' log says he started (ai-carling's codes, as Football Manager writes
 *  them), and the slot each stands for (spec/14, How a rule scores: left and right alike). A code
 *  not here maps to no slot, and the start is skipped. */
const SLOT_OF_STARTING_POSITION: Readonly<Record<string, SlotPosition>> = {
  GK: "GK",
  DL: "FB",
  DR: "FB",
  DC: "CB",
  DCL: "CB",
  DCR: "CB",
  WBL: "WB",
  WBR: "WB",
  DML: "WB",
  DMR: "WB",
  DM: "CDM",
  DMC: "CDM",
  ML: "WM",
  MR: "WM",
  MC: "CM",
  MCL: "CM",
  MCR: "CM",
  AML: "W",
  AMR: "W",
  AMC: "CAM",
  AMCL: "CAM",
  AMCR: "CAM",
  ST: "ST",
  STC: "ST",
  STL: "ST",
  STR: "ST",
  FC: "ST",
};

/** The slot a starting position stands for, or null for one that maps to none. */
export const slotOfStart = (startingPosition: string): SlotPosition | null => SLOT_OF_STARTING_POSITION[startingPosition.trim().toUpperCase()] ?? null;

/** One real start in a past season: the year the season starts, where he started, and his stats. */
export interface PastStart {
  season: number;
  startingPosition: string;
  stats: Readonly<Record<string, number>>;
}

/** The catalogue stats a role's bonus and cost count, an own stat taken as its parts, A to Z. */
export function roleStats(set: ScoringSet, role: string): string[] {
  const scoring = set.roles?.find((each) => each.role === role);
  if (scoring === undefined) return [];
  const stats = new Set<string>();
  for (const { stat } of [...scoring.bonus.parts, ...scoring.cost.parts]) {
    const own = set.ownStats?.find((each) => each.stat === stat);
    for (const part of own?.parts ?? [{ stat }]) stats.add(part.stat);
  }
  return [...stats].sort();
}

/** In hundredths, so a flag is never one floating point's noise. */
const hundredths = (points: number): number => Math.round(points * 100);

/** The lab's report on `set` from the past seasons' real starts: each role the set scores, slot by
 *  slot in SLOT_POSITIONS' order (DEFAULT_ROLES'), tested or not. */
export function balanceLab(set: ScoringSet, starts: readonly PastStart[]): LabReport {
  const bySlot = new Map<SlotPosition, PastStart[]>();
  let skipped = 0;
  for (const start of starts) {
    const slot = slotOfStart(start.startingPosition);
    if (slot === null) {
      skipped += 1;
      continue;
    }
    const held = bySlot.get(slot);
    if (held === undefined) bySlot.set(slot, [start]);
    else held.push(start);
  }
  const roles: LabRole[] = [];
  for (const [slot, offered] of Object.entries(DEFAULT_ROLES) as [SlotPosition, (typeof DEFAULT_ROLES)[SlotPosition]][]) {
    const target = ROLE_TARGETS[slot];
    for (const { key: role } of offered) {
      if (set.roles?.some((each) => each.role === role) !== true) continue;
      const stats = roleStats(set, role);
      const missing = stats.filter((stat) => !(stat in PAST_STAT_COLUMNS));
      if (missing.length > 0) {
        roles.push({ role, slot, target, missing });
        continue;
      }
      const tested = (bySlot.get(slot) ?? []).filter((start) => stats.every((stat) => stat in start.stats));
      const total = tested.reduce((sum, start) => sum + roleTotal(start.stats, set, role), 0);
      const average = tested.length === 0 ? null : hundredths(total / tested.length) / 100;
      const offTarget = average !== null && Math.abs(hundredths(average) - hundredths(target)) > hundredths(ROLE_TARGET_MARGIN);
      roles.push({ role, slot, target, starts: tested.length, average, offTarget });
    }
  }
  return {
    seasons: [...new Set(starts.map((start) => start.season))].sort((a, b) => a - b),
    starts: starts.length - skipped,
    startsSkipped: skipped,
    roles,
  };
}
