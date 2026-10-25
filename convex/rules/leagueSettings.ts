import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { refuse } from "../shared/leagueAccess";
import { drawRulesOf } from "./firstRules";
import { changeLatest, editorView, editorViewOf, revisionShape } from "./leagueRules";
import type { LeagueRules } from "./leagueRulesShape";
import { leagueSettingsOf, leagueSettingsShape, type LeagueSettings } from "./leagueSettingsPart";

// League settings (Craig, 22 Oct 2026), read and saved: the part of the rules leagueSettingsPart.ts
// says, as any part of the rules is.

/** Why League settings' change is refused besides unsound rules, in the words the person is shown. */
export const settingsRefusals = {
  /** The screen changes a squad size limit's maximum; it never adds or takes away the limit. */
  squadSizeFixed: "League settings changes the squad's maximum size; it can't add a squad size limit or take one away.",
};

/** The league's settings as League settings edits them, as `editorView` reads them. */
export const settings = query({
  args: { leagueId: v.id("leagues"), now: v.number() },
  returns: editorViewOf(leagueSettingsShape),
  handler: (ctx, { leagueId, now }) => editorView(ctx, leagueId, now, leagueSettingsOf),
});

/** League settings' change: the latest rules with these settings, as `changeLatest` saves them.
 *  Its limits are the rules' check's (leagueRulesCheck.ts): games a gameweek a whole number, 1 or
 *  more, and no more than the league's teams have rounds for; the squad's maximum no more than a
 *  Premier League squad, and the minimums by area adding up to no more than it. */
export const changeSettings = mutation({
  args: { leagueId: v.id("leagues"), settings: leagueSettingsShape, revision: revisionShape },
  returns: v.number(),
  handler: (ctx, { leagueId, settings, revision }) => changeLatest(ctx, leagueId, revision, (latest) => withLeagueSettings(latest, settings)),
});

/** The rules with these settings. A draw setting is written only if it differs from what the draw
 *  plays by, so rules saved before it was a rule don't read as changing it. Refused if the
 *  settings would add or take away the squad size limit. */
function withLeagueSettings(rules: LeagueRules, settings: LeagueSettings): LeagueRules {
  const playedBy = drawRulesOf(rules);
  const { size } = rules.squad;
  if ((size === null) !== (settings.squadMaximum === null)) refuse(settingsRefusals.squadSizeFixed);
  return {
    ...rules,
    ...(settings.oddTeamOut !== playedBy.oddTeamOut && { oddTeamOut: settings.oddTeamOut }),
    ...(settings.gamesPerGameweek !== playedBy.gamesPerGameweek && { gamesPerGameweek: settings.gamesPerGameweek }),
    squad: {
      size: size === null || settings.squadMaximum === null ? null : { ...size, maximum: settings.squadMaximum },
      minimumByArea: settings.minimumByArea,
      maxPerClub: settings.maxPerClub,
    },
  };
}
