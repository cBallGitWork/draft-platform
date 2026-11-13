import { v, type Infer } from "convex/values";
import { UNDRAFTED_GO_TO } from "../draft/draftRules";
import { instructionPairShape, instructionShape } from "../lineup/instructionsShape";
import { byArea, cellShape } from "../lineup/pitchShape";
import { scoringSetShape } from "../scoring/scoringSetShape";
import { DOUBLE_GAMEWEEK_RULES } from "../scoring/values";
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
const preset = v.object({
  name: v.string(),
  cells: v.array(cellShape),
  /** Its default team instructions (#990): absent only from presets saved before them, which read
   *  instructions.ts's first defaults. */
  instructions: v.optional(instructionPairShape),
  /** presets.ts's BackLineScoring, null for none (#990): absent only from presets saved before it,
   *  which read presets.ts's first values. */
  backLine: v.optional(v.union(v.object({ cleanSheet: v.number(), goalConceded: v.number() }), v.null())),
});

/** A preset as rows hold it: one saved between #988 and #1159 may also carry the role its
 *  defence's centre started on, dropped with the sweeper and libero presets (Craig, 5 Nov 2026),
 *  which nothing reads (`heldRules` drops it), optional so those rows need no migration. */
const storedPreset = v.object({ ...preset.fields, centreRole: v.optional(v.string()) });

/** classicFormations.ts's ClassicFormation. */
export const classicFormationShape = v.object({
  name: v.string(),
  subtitle: v.string(),
  description: v.string(),
  cells: v.array(cellShape.extend({ role: v.string() })),
  instructions: v.object({ attacking: v.string(), defensive: v.string() }),
});

export const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const weekday = v.union(...WEEKDAYS.map((day) => v.literal(day)));

/** roundRobin.ts's OddTeamOut. */
export const oddTeamOutShape = v.union(...ODD_TEAM_OUTS.map((name) => v.literal(name)));

/** The draft's rules (spec/04; #1087): its limits are ../draft/draftLimits.ts's. */
export const draftRulesShape = v.object({
  /** Each pick's clock, in whole seconds. */
  pickSeconds: v.number(),
  /** How many timeouts a manager gets before he goes on auto-pick; null: never, and the clock
   *  runs for every pick. */
  timeoutsBeforeAutoPick: v.union(v.number(), v.null()),
  /** ../draft/draftRules.ts's UndraftedGoTo. */
  undrafted: v.union(...UNDRAFTED_GO_TO.map((name) => v.literal(name))),
});
export type DraftRules = Infer<typeof draftRulesShape>;

/** Who reviews an accepted trade: nobody, the commissioner (a veto) or the other managers (a vote),
 *  in spec/03's order. */
export const TRADE_REVIEWS = ["none", "veto", "vote"] as const;
export type TradeReview = (typeof TRADE_REVIEWS)[number];

/** How the league's trades run (spec/03, spec/08; #383). */
export const tradeRulesShape = v.object({
  /** Who reviews an accepted trade (`TRADE_REVIEWS`). */
  review: v.union(...TRADE_REVIEWS.map((name) => v.literal(name))),
  /** The gameweek after whose last match no trades are made; null: no trade deadline. */
  deadline: v.union(v.number(), v.null()),
});
export type TradeRules = Infer<typeof tradeRulesShape>;

/** The waiver order's types (spec/03, spec/08): reverse table order, the default, or rotating. */
export const WAIVER_ORDERS = ["reverseStandings", "rotating"] as const;
export type WaiverOrderType = (typeof WAIVER_ORDERS)[number];

/** How the league's waivers run (spec/03, spec/08). */
export const waiverRulesShape = v.object({
  /** When they run each week, UK time (spec/08): one run or more. */
  runs: v.array(v.object({ day: weekday, hour: v.number(), minute: v.number() })),
  order: v.union(...WAIVER_ORDERS.map((name) => v.literal(name))),
});
export type WaiverRules = Infer<typeof waiverRulesShape>;

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
  /** The league's classic formations, under the key they were first saved with (#1620). Absent
   *  only from rules saved before #991, which play the first rules' (firstRules.ts,
   *  `classicFormationsOf`). */
  classics: v.optional(v.array(classicFormationShape)),
  /** deadline.ts's DeadlineRule. */
  deadline: v.object({ minutesBeforeFirstKickoff: v.number() }),
  /** values.ts's DoubleGameweekRule. */
  doubleGameweek: v.union(...DOUBLE_GAMEWEEK_RULES.map((name) => v.literal(name))),
  /** standings.ts's TieBreak, in the league's order. */
  tieBreaks: v.array(v.union(...TIE_BREAKS.map((name) => v.literal(name)))),
  /** roundRobin.ts's OddTeamOut. Required since #147 backfilled the rows saved before #33
   *  (ARCHITECTURE.md's Data, "Changing a saved shape"). */
  oddTeamOut: oddTeamOutShape,
  /** roundRobin.ts's DrawRules["gamesPerGameweek"]: a whole number, 1 or more. Required, as
   *  `oddTeamOut` is. */
  gamesPerGameweek: v.number(),
  waivers: waiverRulesShape,
  /** How the draft runs (spec/04; #1087). Absent only from rules saved before
   *  #1087, which play the first rules' (firstRules.ts, `draftRulesOf`). */
  draft: v.optional(draftRulesShape),
  /** How trades run (spec/08; #383). Absent, as `draft` is, only from rules saved before #383,
   *  which play the first rules' (firstRules.ts, `tradeRulesOf`). */
  trades: v.optional(tradeRulesShape),
  /** The team instructions a manager picks from (spec/05, Team instructions; #990). Absent, as
   *  `draft` is, only from rules saved before #990, which play the first rules' (firstRules.ts,
   *  `instructionsOf`). */
  instructions: v.optional(v.array(instructionShape)),
});

export type LeagueRules = Infer<typeof leagueRulesShape>;

/** What a save of the rules stores (#1617): only the parts it changed, each whole, the rest as the
 *  row before holds them (Craig, 11 Nov 2026: "a save stores only what changed"), so a change of a
 *  waiver time doesn't copy the formations and classics again. */
export const rulesChangesShape = leagueRulesShape.partial();
export type RulesChanges = Infer<typeof rulesChangesShape>;

/** The draft's rules as rows hold them: rows saved between #1087 and #1089 also carry how the draft
 *  order was set, a switch Craig dropped ("Drop it", 4 Nov 2026, on #1089), which nothing reads
 *  (`heldRules` drops it), optional so they need no migration. */
const storedDraftRulesShape = v.object({ ...draftRulesShape.fields, order: v.optional(v.union(v.literal("commissioner"), v.literal("random"))) });

/** A league's rules as rows hold them: rows saved before #354 also carry the scoring set the
 *  league then had, which nothing reads (`heldRules` drops it), optional so they need no migration;
 *  the draft's, its dropped order (`storedDraftRulesShape`); and the presets', their dropped centre
 *  role (`storedPreset`). */
export const storedLeagueRulesShape = v.object({
  ...leagueRulesShape.fields,
  presets: v.array(storedPreset),
  draft: v.optional(storedDraftRulesShape),
  scoring: v.optional(scoringSetShape),
});

/** A rules row's rules without the scoring a row saved before #354 carries, the draft order a row
 *  saved before #1089 does, or the presets' centre role one saved after #988 may. */
export function heldRules({ scoring: _scoring, draft, presets: stored, ...rest }: Infer<typeof storedLeagueRulesShape>): LeagueRules {
  const rules = { ...rest, presets: stored.map(({ centreRole: _centreRole, ...preset }) => preset) };
  if (draft === undefined) return rules;
  const { order: _order, ...held } = draft;
  return { ...rules, draft: held };
}
