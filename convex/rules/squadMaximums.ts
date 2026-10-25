import { v, type Infer } from "convex/values";
import { STARTER_COUNT } from "../lineup/lineup";
import { FEWEST_TEAMS, MOST_IN_SQUAD, MOST_TEAMS } from "../leagues/leagueLimits";
import { UnsoundRules } from "./leagueRulesCheck";
import type { LeagueRules } from "./leagueRulesShape";

// A new league's squad maximum, by the league's size (spec/03, Squad make-up; #316): the site's
// own table, one row, which Craig edits ("an 8 man league would have 16 id say ish"; "we can edit
// that ourselves"). The league's size is its maximum of teams. Changing the table changes the next
// new league's maximum, never a league already made. Pure: the table is read and set in
// leagueRules.ts, which says how to set it until the admin has a screen.

/** From this many teams up to the next band's, a new league's squad maximum is `maximum`. */
export const squadMaximumBandShape = v.object({ fromTeams: v.number(), maximum: v.number() });
export type SquadMaximumBand = Infer<typeof squadMaximumBandShape>;

/** Claude's starting data, never Craig's (#316): written as the table by the first league a
 *  deployment makes; after that the app reads only the table. #316 gave 4–6 teams 20; the band starts at the
 *  fewest a league may have, so 2 and 3 teams take 20 too. */
export const STARTING_SQUAD_MAXIMUMS: readonly SquadMaximumBand[] = [
  { fromTeams: FEWEST_TEAMS, maximum: 20 },
  { fromTeams: 7, maximum: 16 },
  { fromTeams: 9, maximum: 15 },
  { fromTeams: 11, maximum: 14 },
];

/** The squad maximum the bands give a league of `maxTeams`: the last band starting at or below it.
 *  The bands are checked (`checkSquadMaximums`), so the first starts at the fewest teams. */
export function squadMaximumFor(bands: readonly SquadMaximumBand[], maxTeams: number): number {
  const band = bands.findLast((each) => each.fromTeams <= maxTeams);
  if (band === undefined) throw new Error(`No squad maximum band covers a league of ${maxTeams} teams`);
  return band.maximum;
}

/** The rules with their squad maximum set to `maximum`. Rules with no squad size limit keep none. */
export function withSquadMaximum(rules: LeagueRules, maximum: number): LeagueRules {
  const { size } = rules.squad;
  return size === null ? rules : { ...rules, squad: { ...rules.squad, size: { ...size, maximum } } };
}

/** Throws the first reason the bands can't be the table: each league size needs one band, from the
 *  fewest teams on, and each maximum must be one a league could save. */
export function checkSquadMaximums(bands: readonly SquadMaximumBand[]): void {
  if (bands[0]?.fromTeams !== FEWEST_TEAMS) {
    throw new UnsoundRules(`The first squad maximum must start at ${FEWEST_TEAMS} teams, the fewest a league may have.`);
  }
  bands.forEach(({ fromTeams, maximum }, index) => {
    const previous = bands[index - 1]?.fromTeams ?? FEWEST_TEAMS - 1;
    if (!Number.isInteger(fromTeams) || fromTeams <= previous || fromTeams > MOST_TEAMS) {
      throw new UnsoundRules(`Each squad maximum starts at a whole number of teams, above the one before and at most ${MOST_TEAMS}, not ${fromTeams}.`);
    }
    if (!Number.isInteger(maximum) || maximum < STARTER_COUNT || maximum > MOST_IN_SQUAD) {
      throw new UnsoundRules(`A squad maximum is a whole number from ${STARTER_COUNT} to ${MOST_IN_SQUAD}, not ${maximum}.`);
    }
  });
}
