import type { ScoringSet } from "../scoring/scoringSet";
import type { LeagueRules } from "./leagueRulesShape";

// What a league plays, asked in one place (#1582; Craig, 11 Nov 2026: "dont build classic mode yet
// but these flags will be handy"). Every league plays roles, team instructions and stars, and the
// higher score wins; whether it has matchups is its format. No rule picks a mode yet: that is the
// modes' grill's, so the answers other than `hasMatchups` are the same for every league today.
// Pure: no I/O, so the screens read it too.

/** What a league plays in a gameweek, by its rules then. */
export interface GameMode {
  /** Its men score their roles' points (spec/05, Roles). */
  scoresRoles: boolean;
  /** Its teams score their instructions and back line (spec/05, Team instructions). */
  scoresInstructions: boolean;
  /** Its men's stars are shown and copied at the deadline. */
  showsStars: boolean;
  /** Its teams meet in matchups, head-to-head; total points has none. */
  hasMatchups: boolean;
  /** The higher score wins a matchup and tops the table. */
  higherWins: boolean;
}

/** What a league with these rules plays. */
export function gameModeOf(rules: Pick<LeagueRules, "format">): GameMode {
  return {
    scoresRoles: true,
    scoresInstructions: true,
    showsStars: true,
    hasMatchups: rules.format === "headToHead",
    higherWins: true,
  };
}

/** The site's scoring set as a league in `mode` scores it: without its roles' scoring if it plays
 *  no roles, and without its instructions' (the back line among them) if it plays no team
 *  instructions. A league that plays both gets the very set read, so it is checked once
 *  (scoring.ts's `checkedOnce`). The scorer's one seam (teamGameweek.ts's `rulesIn`). */
export function playedSet<Set extends Pick<ScoringSet, "roles" | "instructions">>(
  set: Set,
  mode: Pick<GameMode, "scoresRoles" | "scoresInstructions">,
): Set {
  if (mode.scoresRoles && mode.scoresInstructions) return set;
  return { ...set, ...(!mode.scoresRoles && { roles: undefined }), ...(!mode.scoresInstructions && { instructions: undefined }) };
}
