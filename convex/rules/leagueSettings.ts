import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { seasonGameweekCount } from "../gameweeks/seasonGameweeks";
import { refuse } from "../shared/leagueAccess";
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

/** The league's settings as League settings edits them, as `editorView` reads them, with how many
 *  gameweeks the season has, the latest a trade deadline can be (#1618). */
export const settings = query({
  args: { leagueId: v.id("leagues"), now: v.number() },
  returns: v.object({ ...editorViewOf(leagueSettingsShape).fields, seasonGameweeks: v.number() }),
  handler: async (ctx, { leagueId, now }) => ({
    ...(await editorView(ctx, leagueId, now, leagueSettingsOf)),
    seasonGameweeks: await seasonGameweekCount(ctx),
  }),
});

/** League settings' change: the latest rules with these settings, as `changeLatest` saves them.
 *  Its limits are the rules' check's (leagueRulesCheck.ts): games a gameweek a whole number, 1 or
 *  more, and no more than the league's teams have rounds for; the squad's maximum no more than a
 *  Premier League squad, and the minimums by area adding up to no more than it; the pick clock and
 *  the timeouts before auto-pick within ../draft/draftLimits.ts's; a trade deadline a gameweek of
 *  the season; waivers run at least once a week, never twice at one time. */
export const changeSettings = mutation({
  args: { leagueId: v.id("leagues"), settings: leagueSettingsShape, revision: revisionShape },
  returns: v.number(),
  handler: (ctx, { leagueId, settings, revision }) => changeLatest(ctx, leagueId, revision, (latest) => withLeagueSettings(latest, settings)),
});

/** The rules with these settings. Rules saved before the draft or the trades were rules don't read
 *  as changing them, as `changeRules` reads each side as it plays. Refused if the settings would
 *  add or take away the squad size limit. */
function withLeagueSettings(rules: LeagueRules, settings: LeagueSettings): LeagueRules {
  const { size } = rules.squad;
  if ((size === null) !== (settings.squadMaximum === null)) refuse(settingsRefusals.squadSizeFixed);
  return {
    ...rules,
    oddTeamOut: settings.oddTeamOut,
    gamesPerGameweek: settings.gamesPerGameweek,
    draft: settings.draft,
    trades: settings.trades,
    waivers: settings.waivers,
    squad: {
      size: size === null || settings.squadMaximum === null ? null : { ...size, maximum: settings.squadMaximum },
      minimumByArea: settings.minimumByArea,
      maxPerClub: settings.maxPerClub,
    },
  };
}
