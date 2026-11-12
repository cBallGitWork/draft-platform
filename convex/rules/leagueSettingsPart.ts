import { v, type Infer } from "convex/values";
import { draftRulesOf, drawRulesOf, tradeRulesOf } from "./firstRules";
import { squadMaximumOf } from "./squadMaximums";
import { draftRulesShape, leagueRulesShape, oddTeamOutShape, tradeRulesShape, waiverRulesShape, type LeagueRules } from "./leagueRulesShape";

// The part of a league's rules League settings edits (Craig, 22 Oct 2026): those that build the
// league; players' points are the site's (spec/14, Who owns it). The round robin's two (spec/09),
// the squad's make-up (spec/03, Squad make-up; #341), how the draft runs (spec/04; #1087), how
// trades do (spec/08; #383) and how waivers do (spec/08; #1200). Pure, so the screens' previews read it too; leagueSettings.ts reads
// and saves it.

const squad = leagueRulesShape.fields.squad.fields;

export const leagueSettingsShape = v.object({
  oddTeamOut: oddTeamOutShape,
  gamesPerGameweek: v.number(),
  /** The squad size's maximum; null for rules with no squad size limit, which keep none. */
  squadMaximum: v.union(v.number(), v.null()),
  minimumByArea: squad.minimumByArea,
  maxPerClub: squad.maxPerClub,
  draft: draftRulesShape,
  trades: tradeRulesShape,
  /** The waiver order's type and the runs (spec/03, spec/08; #1200). */
  waivers: waiverRulesShape,
});
export type LeagueSettings = Infer<typeof leagueSettingsShape>;

/** The league's settings as League settings shows them: the draw's as it plays by them, so rules
 *  saved before they were rules read as the first rules' values (`drawRulesOf`), and the draft's
 *  and the trades' likewise (`draftRulesOf`, `tradeRulesOf`). */
export const leagueSettingsOf = (rules: LeagueRules): LeagueSettings => ({
  ...drawRulesOf(rules),
  squadMaximum: squadMaximumOf(rules),
  minimumByArea: rules.squad.minimumByArea,
  maxPerClub: rules.squad.maxPerClub,
  draft: draftRulesOf(rules),
  trades: tradeRulesOf(rules),
  waivers: rules.waivers,
});
