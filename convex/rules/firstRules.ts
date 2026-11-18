import { DEFAULT_DEADLINE_RULE } from "../gameweeks/deadline";
import type { DraftRules, LeagueRules, TradeRules } from "./leagueRulesShape";
import { AREAS, type Area } from "../lineup/pitch";
import type { AreaLimit } from "../lineup/lineup";
import type { Line } from "../shared/lineNames";
import { FIRST_INSTRUCTIONS, type Instruction } from "../lineup/instructions";
import { FIRST_PRESETS } from "../lineup/presets";
import { FIRST_CLASSIC_FORMATIONS } from "../lineup/classicFormations";
import type { DrawRules } from "../table/roundRobin";
import { TIE_BREAKS } from "../table/standings";

// The first rules a deployment gives a new league (#25), used once: the first league created
// copies them into the admin's default rules row (`defaultLeagueRules`), and every league after
// copies that row, which the admin edits (leagueRules.ts says how). Once that row exists, nothing
// reads this file but `draftRulesOf`, `tradeRulesOf`, `instructionsOf`, `classicFormationsOf` and `lineLimitsOf`,
// for rules saved before the draft, trades, the team instructions, the classic formations and the line limits were among them. The scoring is not a league's rule but the
// site's (spec/14, Who owns it): ../scoring/firstScoring.ts holds the first set.
//
// Only the presets, the team instructions, the deadline, the double-gameweek rule, games a
// gameweek, the draft's rules and the trades' are the spec's own or Craig's (spec/05,
// spec/03, spec/09, spec/04, spec/08). The rest are starting values the commissioner edits, settled
// as such by Craig (spec/01: "stop tunneling in on first format we will edit later"), each marked
// where it stands, against docs/research/fantrax-options.md's live values where it has them.

function everyArea<Value>(value: Value): Record<Area, Value> {
  return Object.fromEntries(AREAS.map((area) => [area, value])) as Record<Area, Value>;
}

/** Craig's: one head-to-head game a gameweek, unless a league chooses more (spec/09). */
const FIRST_GAMES_PER_GAMEWEEK = 1;

/** Craig's (4 Nov 2026, on #1087; spec/04): a 90-second pick clock; auto-pick after 2 timeouts;
 *  undrafted players to waivers. */
const FIRST_DRAFT_RULES: DraftRules = { pickSeconds: 90, timeoutsBeforeAutoPick: 2, undrafted: "waivers" };

/** Craig's (6 Nov 2026, on #991): eight to start, their text sample (../lineup/classicFormations.ts). */
const firstClassicFormations = (): LeagueClassicFormations =>
  FIRST_CLASSIC_FORMATIONS.map(({ cells, instructions, ...rest }) => ({ ...rest, cells: cells.map((cell) => ({ ...cell })), instructions: { ...instructions } }));

/** A league's classic formations, as its rules hold them under their saved key, `classics`
 *  (../lineup/classicFormations.ts's ClassicFormation). */
type LeagueClassicFormations = NonNullable<LeagueRules["classics"]>;

/** The league's classic formations: the first rules' for rules saved before #991 made them rules. */
export const classicFormationsOf = (rules: LeagueRules): LeagueClassicFormations => rules.classics ?? firstClassicFormations();

/** How the league's draft runs: the first rules' for rules saved before #1087 made it a rule. */
export const draftRulesOf = (rules: LeagueRules): DraftRules => rules.draft ?? FIRST_DRAFT_RULES;

/** Craig's (6 Nov 2026, on #383): a new league's trades are reviewed by a commissioner veto, and
 *  it has no trade deadline until its commissioner sets one. */
const FIRST_TRADE_RULES: TradeRules = { review: "veto", deadline: null };

/** Craig's (spec/03, spec/08; 5 Nov 2026): the time of day of each of the first waiver runs, 18:00
 *  UK time, and of a run the settings add. */
export const FIRST_RUN_TIME = { hour: 18, minute: 0 } as const;

/** How the league's trades run: the first rules' for rules saved before #383 made it a rule. */
export const tradeRulesOf = (rules: LeagueRules): TradeRules => rules.trades ?? FIRST_TRADE_RULES;

/** The league's tie-breaks with each it lacks added after its own (Craig, 15 Nov 2026, on #1034):
 *  every league has all three, and rules saved with fewer keep theirs first. A save puts them in
 *  the rules from the next gameweek (../migrations/everyTieBreak.ts); the table reads the rules'
 *  own until then. */
export const tieBreaksOf = ({ tieBreaks }: LeagueRules): LeagueRules["tieBreaks"] => [
  ...tieBreaks,
  ...TIE_BREAKS.filter((tieBreak) => !tieBreaks.includes(tieBreak)),
];

/** How the league's round robin is drawn: its games a gameweek. */
export const drawRulesOf = ({ gamesPerGameweek }: LeagueRules): DrawRules => ({ gamesPerGameweek });

/** The team instructions a league picks from: the first rules' for rules saved before #990 made
 *  them rules. */
export const instructionsOf = (rules: Pick<LeagueRules, "instructions">): readonly Instruction[] => rules.instructions ?? FIRST_INSTRUCTIONS;

/** Craig's (15 Nov 2026; spec/22 `S22.9`): each line's limits on a classic league's pitch, a
 *  league rule its commissioner can change (16 Nov 2026). */
const FIRST_LINE_LIMITS: Record<Line, AreaLimit> = {
  GK: { minimum: 1, maximum: 1 },
  DEF: { minimum: 3, maximum: 5 },
  CM: { minimum: 1, maximum: 5 },
  AM: { minimum: 0, maximum: 4 },
  FWD: { minimum: 1, maximum: 3 },
};

/** Each line's limits on a classic league's pitch: the first rules' for rules that never set them. */
export const lineLimitsOf = (rules: Pick<LeagueRules, "lineLimits">): Record<Line, AreaLimit> => rules.lineLimits ?? FIRST_LINE_LIMITS;

export const FIRST_RULES: LeagueRules = {
  format: "headToHead", // a starting value (spec/01): the Tim Hortons league plays head-to-head matchups
  squad: {
    // A starting value (spec/01): 14 is the Tim Hortons league's draft rounds on Fantrax, which spec/04 makes the
    // maximum; 11 is only enough to field a team. No league is made with 14: a new league's
    // maximum is the site's for its size (squadMaximums.ts).
    size: { minimum: 11, maximum: 14 },
    minimumByArea: null,
    maxPerClub: null,
  },
  // A starting value (spec/01): spec/05 sets no defaults. One goalkeeper, and room for every preset.
  areaLimits: { ...everyArea({ minimum: 0, maximum: 10 }), goalkeeper: { minimum: 1, maximum: 1 } },
  presets: FIRST_PRESETS.map(({ cells, instructions, ...rest }) => ({
    ...rest,
    cells: cells.map((cell) => ({ ...cell })),
    ...(instructions !== undefined && { instructions: { ...instructions } }),
  })),
  classics: firstClassicFormations(),
  deadline: { ...DEFAULT_DEADLINE_RULE },
  doubleGameweek: "bothMatches",
  // Craig's (S03.8; 15 Nov 2026, on #1034): every league has all three tie-breaks, in its own
  // order, these to start.
  tieBreaks: [...TIE_BREAKS],
  gamesPerGameweek: FIRST_GAMES_PER_GAMEWEEK,
  // Craig's (spec/03, spec/08; 5 Nov 2026): Wednesday and Thursday at 18:00 UK time, "for now",
  // and reverse table order. The 24 hours on waivers is a constant (../waivers/waiverLimits.ts).
  waivers: {
    runs: [
      { day: "wednesday", ...FIRST_RUN_TIME },
      { day: "thursday", ...FIRST_RUN_TIME },
    ],
    order: "reverseStandings",
  },
  draft: { ...FIRST_DRAFT_RULES },
  trades: { ...FIRST_TRADE_RULES },
  // Craig's (spec/05, 4 Nov 2026), each description Claude's draft for him to edit.
  instructions: FIRST_INSTRUCTIONS.map((instruction) => ({ ...instruction })),
};
