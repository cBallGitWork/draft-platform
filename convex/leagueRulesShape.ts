import { v, type Infer, type Validator } from "convex/values";
import { AREAS, LANES } from "./pitch";

// The shape a league's rules are stored in (spec/03; #25). Each part is the input type of the pure
// module that reads it, so a stored rule passes straight in: the scoring set to scoring.ts, the
// area limits to lineup.ts, the deadline to deadline.ts. leagueRulesShape.test.ts holds them equal.
// What makes a rule sound beyond its shape (a minimum above its maximum) is leagueRulesCheck.ts's.

/** The same validator for each of the pitch's six areas: a ByArea<Value>, or a Record<Area, …>. */
function byArea<Value extends Validator<unknown, "required", string>>(value: Value) {
  return v.object({
    goalkeeper: value,
    defence: value,
    defensiveMidfield: value,
    midfield: value,
    attackingMidfield: value,
    attack: value,
  });
}

const area = v.union(...AREAS.map((name) => v.literal(name)));
const lane = v.union(...LANES.map((name) => v.literal(name)));

/** A minimum and maximum, as lineup.ts's AreaLimit. */
const limit = v.object({ minimum: v.number(), maximum: v.number() });

const band = v.object({ atLeast: v.number(), points: v.number() });

/** scoringSet.ts's ScoringSet. */
const scoringSetShape = v.object({
  rules: v.array(
    v.union(
      v.object({ shape: v.literal("perAction"), stat: v.string(), byArea: byArea(v.number()) }),
      v.object({
        shape: v.literal("perCount"),
        stat: v.string(),
        byArea: byArea(v.object({ every: v.number(), points: v.number() })),
      }),
      v.object({ shape: v.literal("bands"), stat: v.string(), stack: v.boolean(), byArea: byArea(v.array(band)) }),
    ),
  ),
});

/** presets.ts's Preset. */
const preset = v.object({ name: v.string(), cells: v.array(v.object({ area, lane })) });

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const weekday = v.union(...WEEKDAYS.map((day) => v.literal(day)));

/** Standings tie-breaks, applied in the league's order (spec/03). */
const TIE_BREAKS = ["pointsFor", "headToHead", "pointsAgainst"] as const;

export const leagueRulesShape = v.object({
  format: v.union(v.literal("headToHead"), v.literal("totalPoints")),
  squad: v.object({
    /** Null: no limit on squad size. */
    size: v.union(limit, v.null()),
    /** How many of a squad may play each area (how a player's areas count is #31's); null: no limits. */
    byArea: v.union(byArea(limit), v.null()),
    /** Null: no limit. */
    maxPerClub: v.union(v.number(), v.null()),
  }),
  /** Each area's minimum and maximum on the pitch: lineup.ts's LineupRules["areaLimits"]. */
  areaLimits: byArea(limit),
  presets: v.array(preset),
  /** deadline.ts's DeadlineRule. */
  deadline: v.object({ minutesBeforeFirstKickoff: v.number() }),
  /** scoring.ts's DoubleGameweekRule. */
  doubleGameweek: v.union(v.literal("bothMatches"), v.literal("bestMatch")),
  tieBreaks: v.array(v.union(...TIE_BREAKS.map((name) => v.literal(name)))),
  waivers: v.object({
    /** When they run each week, UK time (spec/08): one run or more. */
    runs: v.array(v.object({ day: weekday, hour: v.number(), minute: v.number() })),
    order: v.union(v.literal("reverseStandings"), v.literal("rotating")),
  }),
  scoring: scoringSetShape,
});

export type LeagueRules = Infer<typeof leagueRulesShape>;
