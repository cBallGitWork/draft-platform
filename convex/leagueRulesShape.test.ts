import { expect, expectTypeOf, test } from "vitest";
import type { DeadlineRule } from "./deadline";
import { FIRST_RULES } from "./firstRules";
import { lineupProblems, type LineupRules } from "./lineup";
import type { LeagueRules } from "./leagueRulesShape";
import { DEFAULT_PRESETS, type Preset } from "./presets";
import { scoreGameweek, scoreMatch, type DoubleGameweekRule } from "./scoring";
import type { ScoringSet } from "./scoringSet";

// The stored rules are the pure modules' own inputs (#25): what Convex accepts as a rule must type
// as what scoring.ts, lineup.ts, deadline.ts and presets.ts read, and the other way round. A field
// renamed in one and not the other fails `npm run typecheck` here.

/** The same type both ways, readonly aside: Convex hands back plain arrays. */
type Writable<T> = T extends readonly (infer Item)[]
  ? Writable<Item>[]
  : T extends object
    ? { -readonly [K in keyof T]: Writable<T[K]> }
    : T;

test("each stored part is its module's input type", () => {
  expectTypeOf<LeagueRules["scoring"]>().toEqualTypeOf<Writable<ScoringSet>>();
  expectTypeOf<LeagueRules["areaLimits"]>().toEqualTypeOf<Writable<LineupRules["areaLimits"]>>();
  expectTypeOf<LeagueRules["presets"]>().toEqualTypeOf<Writable<Preset[]>>();
  expectTypeOf<LeagueRules["deadline"]>().toEqualTypeOf<DeadlineRule>();
  expectTypeOf<LeagueRules["doubleGameweek"]>().toEqualTypeOf<DoubleGameweekRule>();
});

test("the first rules' presets are the eleven every league starts with", () => {
  expect(FIRST_RULES.presets).toEqual(DEFAULT_PRESETS);
});

test("stored rules pass straight into scoring and the lineup check", () => {
  const { scoring, areaLimits, doubleGameweek } = FIRST_RULES;
  const match = scoreMatch({ minutes: 90, goals_scored: 1 }, scoring, "attack");
  expect(match.total).toBe(6);
  expect(scoreGameweek([match], doubleGameweek)).toEqual({ points: 6, provisional: false });
  expect(lineupProblems({ starters: [], bench: [] }, new Map(), { areaLimits })).toContainEqual({
    kind: "belowMinimum",
    area: "goalkeeper",
    starterCount: 0,
    minimum: 1,
  });
});
