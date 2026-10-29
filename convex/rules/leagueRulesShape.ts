import { v, type Infer } from "convex/values";
import { byArea, cellShape } from "../lineup/pitchShape";
import { scoringSetShape } from "../scoring/scoringSetShape";
import { DOUBLE_GAMEWEEK_RULES } from "../scoring/scoring";
import { ODD_TEAM_OUTS } from "../table/roundRobin";
import { TIE_BREAKS } from "../table/standings";

// The shape a league's rules are stored in (spec/03; #25). Each part is the input type of the pure
// module that reads it, so a stored rule passes straight in: the area limits to lineup.ts, the
// deadline to deadline.ts, the tie-breaks to standings.ts and the odd team out to roundRobin.ts.
// leagueRulesShape.test.ts holds them equal. The pitch's validators are ../lineup/pitchShape.ts's,
// and the site's scoring set's, which a league's rules held until #354, ../scoring/scoringSetShape.ts's.
// What makes a rule sound beyond its shape (a minimum above its maximum) is leagueRulesCheck.ts's.

/** A minimum and maximum, as lineup.ts's AreaLimit. */
const limit = v.object({ minimum: v.number(), maximum: v.number() });

/** presets.ts's Preset. */
const preset = v.object({ name: v.string(), cells: v.array(cellShape) });

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const weekday = v.union(...WEEKDAYS.map((day) => v.literal(day)));

/** roundRobin.ts's OddTeamOut. */
export const oddTeamOutShape = v.union(...ODD_TEAM_OUTS.map((name) => v.literal(name)));

export const leagueRulesShape = v.object({
  format: v.union(v.literal("headToHead"), v.literal("totalPoints")),
  squad: v.object({
    /** Null: no limit on squad size. */
    size: v.union(limit, v.null()),
    /** The fewest of a squad who play each area, and nothing else per area (spec/03, Squad make-up:
     *  "a squad can be full of whatever you want with a few minimum counts"); null: none. */
    minimumByArea: v.union(byArea(v.number()), v.null()),
    /** Null: no limit, as the first rules have it (spec/03: off by default). */
    maxPerClub: v.union(v.number(), v.null()),
  }),
  /** Each area's minimum and maximum on the pitch: lineup.ts's LineupRules["areaLimits"]. */
  areaLimits: byArea(limit),
  presets: v.array(preset),
  /** deadline.ts's DeadlineRule. */
  deadline: v.object({ minutesBeforeFirstKickoff: v.number() }),
  /** scoring.ts's DoubleGameweekRule. */
  doubleGameweek: v.union(...DOUBLE_GAMEWEEK_RULES.map((name) => v.literal(name))),
  /** standings.ts's TieBreak, in the league's order. */
  tieBreaks: v.array(v.union(...TIE_BREAKS.map((name) => v.literal(name)))),
  /** roundRobin.ts's OddTeamOut. Absent only from rules saved before #33, which play the first
   *  rules' (firstRules.ts, `drawRulesOf`): optional, so those rows need no migration. */
  oddTeamOut: v.optional(oddTeamOutShape),
  /** roundRobin.ts's DrawRules["gamesPerGameweek"]: a whole number, 1 or more. Absent, as
   *  `oddTeamOut` is, only from rules saved before #130. */
  gamesPerGameweek: v.optional(v.number()),
  waivers: v.object({
    /** When they run each week, UK time (spec/08): one run or more. */
    runs: v.array(v.object({ day: weekday, hour: v.number(), minute: v.number() })),
    order: v.union(v.literal("reverseStandings"), v.literal("rotating")),
  }),
});

export type LeagueRules = Infer<typeof leagueRulesShape>;

/** A league's rules as rows hold them: rows saved before #354 also carry the scoring set the
 *  league then had, which nothing reads (`heldRules` drops it), optional so they need no migration. */
export const storedLeagueRulesShape = v.object({ ...leagueRulesShape.fields, scoring: v.optional(scoringSetShape) });

/** A rules row's rules without the scoring a row saved before #354 carries. */
export function heldRules({ scoring: _scoring, ...rules }: Infer<typeof storedLeagueRulesShape>): LeagueRules {
  return rules;
}
