import { v, type Infer } from "convex/values";
import { drawRulesOf } from "./firstRules";
import { leagueRulesShape, oddTeamOutShape, type LeagueRules } from "./leagueRulesShape";

// The part of a league's rules League settings edits (Craig, 22 Oct 2026): those that build the
// league; players' points are the site's (spec/14, Who owns it). The round robin's two (spec/09)
// and the squad's make-up (spec/03, Squad make-up; #341). Pure, so the screens' previews read it
// too; leagueSettings.ts reads and saves it.

const squad = leagueRulesShape.fields.squad.fields;

export const leagueSettingsShape = v.object({
  oddTeamOut: oddTeamOutShape,
  gamesPerGameweek: v.number(),
  /** The squad size's maximum; null for rules with no squad size limit, which keep none. */
  squadMaximum: v.union(v.number(), v.null()),
  minimumByArea: squad.minimumByArea,
  maxPerClub: squad.maxPerClub,
});
export type LeagueSettings = Infer<typeof leagueSettingsShape>;

/** The league's settings as League settings shows them: the draw's as it plays by them, so rules
 *  saved before they were rules read as the first rules' values (`drawRulesOf`). */
export const leagueSettingsOf = (rules: LeagueRules): LeagueSettings => ({
  ...drawRulesOf(rules),
  squadMaximum: rules.squad.size?.maximum ?? null,
  minimumByArea: rules.squad.minimumByArea,
  maxPerClub: rules.squad.maxPerClub,
});
