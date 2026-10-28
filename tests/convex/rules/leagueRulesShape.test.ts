import { expect, expectTypeOf, test } from "vitest";
import type { DeadlineRule } from "../../../convex/gameweeks/deadline";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import { lineupProblems, type LineupRules } from "../../../convex/lineup/lineup";
import type { LeagueRules, StoredScoringSet } from "../../../convex/rules/leagueRulesShape";
import { FIRST_SCORING } from "../../../convex/scoring/firstScoring";
import { DEFAULT_PRESETS, type Preset } from "../../../convex/lineup/presets";
import type { DrawRules, OddTeamOut } from "../../../convex/table/roundRobin";
import { scoreGameweek, scoreMatch, type DoubleGameweekRule } from "../../../convex/scoring/scoring";
import { centreOf } from "../../support/convex/scoring.example";
import type { ScoringSet } from "../../../convex/scoring/scoringSet";
import type { TieBreak } from "../../../convex/table/standings";

// The stored rules are the pure modules' own inputs (#25): what Convex accepts as a rule must type
// as what scoring.ts, lineup.ts, deadline.ts, presets.ts, standings.ts and roundRobin.ts read, and the other way round. A field
// renamed in one and not the other fails `npm run typecheck` here.

/** The same type both ways, readonly aside: Convex hands back plain arrays. */
type Writable<T> = T extends readonly (infer Item)[]
  ? Writable<Item>[]
  : T extends object
    ? { -readonly [K in keyof T]: Writable<T[K]> }
    : T;

test("each stored part is its module's input type", () => {
  expectTypeOf<StoredScoringSet>().toEqualTypeOf<Writable<ScoringSet>>();
  expectTypeOf<LeagueRules["areaLimits"]>().toEqualTypeOf<Writable<LineupRules["areaLimits"]>>();
  expectTypeOf<LeagueRules["presets"]>().toEqualTypeOf<Writable<Preset[]>>();
  expectTypeOf<LeagueRules["deadline"]>().toEqualTypeOf<DeadlineRule>();
  expectTypeOf<LeagueRules["doubleGameweek"]>().toEqualTypeOf<DoubleGameweekRule>();
  expectTypeOf<LeagueRules["tieBreaks"]>().toEqualTypeOf<TieBreak[]>();
  // Optional only for rules saved before #33 and #130 (firstRules.ts, drawRulesOf).
  expectTypeOf<LeagueRules["oddTeamOut"]>().toEqualTypeOf<OddTeamOut | undefined>();
  expectTypeOf<LeagueRules["gamesPerGameweek"]>().toEqualTypeOf<DrawRules["gamesPerGameweek"] | undefined>();
});

/** Each of the pitch's six areas, by hand: the stored shape lists them all, no more and no fewer. */
type ByAreaByHand<Value> = {
  goalkeeper: Value;
  defence: Value;
  defensiveMidfield: Value;
  midfield: Value;
  attackingMidfield: Value;
  attack: Value;
};

/** Each position a slot can be, by hand. */
type ByPositionByHand<Value> = {
  GK: Value;
  FB: Value;
  CB: Value;
  WB: Value;
  CDM: Value;
  WM: Value;
  CM: Value;
  W: Value;
  CAM: Value;
  ST: Value;
};

type PricedByHand<Value> = { all: Value } | { byArea: ByAreaByHand<Value> } | { byPosition: ByPositionByHand<Value> };

test("the stored by-area and by-position shapes key exactly the six areas and ten slot positions", () => {
  expectTypeOf<LeagueRules["areaLimits"]>().toEqualTypeOf<ByAreaByHand<{ minimum: number; maximum: number }>>();
  expectTypeOf<LeagueRules["squad"]["minimumByArea"]>().toEqualTypeOf<ByAreaByHand<number> | null>();
  type PerAction = Extract<StoredScoringSet["rules"][number], { shape: "perAction" }>;
  expectTypeOf<PerAction["values"]>().toEqualTypeOf<PricedByHand<number>>();
  expectTypeOf<PerAction["minMinutes"]>().toEqualTypeOf<PricedByHand<number> | undefined>();
});

test("the first rules' presets are the eleven every league starts with", () => {
  expect(FIRST_RULES.presets).toEqual(DEFAULT_PRESETS);
});

test("stored rules pass straight into scoring and the lineup check", () => {
  const { areaLimits, doubleGameweek } = FIRST_RULES;
  const match = scoreMatch({ minutes: 90, goals_scored: 1 }, FIRST_SCORING, centreOf("attack"));
  expect(match.total).toBe(6);
  expect(scoreGameweek([match], doubleGameweek)).toEqual({ points: 6, provisional: false });
  expect(lineupProblems({ starters: [], bench: [] }, new Map(), { areaLimits })).toContainEqual({
    kind: "belowMinimum",
    area: "goalkeeper",
    starterCount: 0,
    minimum: 1,
  });
});
