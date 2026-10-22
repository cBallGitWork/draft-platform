import { v, type Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import { drawRulesOf } from "./firstRules";
import { changeLatest, editorView, editorViewOf, revisionShape } from "./leagueRules";
import { oddTeamOutShape } from "./leagueRulesShape";

// League settings (Craig, 22 Oct 2026): the rules that build the league, apart from players'
// points, which Player scoring edits. For now the round robin's two (spec/09): what the team left
// over with an odd number of teams plays, and the head-to-head games each team plays a gameweek.

export const leagueSettingsShape = v.object({ oddTeamOut: oddTeamOutShape, gamesPerGameweek: v.number() });
export type LeagueSettings = Infer<typeof leagueSettingsShape>;

/** The league's settings as League settings edits them, as `editorView` reads them: those the
 *  draw plays by, so rules saved before they were rules read as the first rules' values. */
export const settings = query({
  args: { leagueId: v.id("leagues"), now: v.number() },
  returns: editorViewOf(leagueSettingsShape),
  handler: (ctx, { leagueId, now }) => editorView(ctx, leagueId, now, drawRulesOf),
});

/** League settings' change: the latest rules with these settings, as `changeLatest` saves them.
 *  A setting is written only if it differs from what the draw plays by, so rules saved before it
 *  was a rule don't read as changing it. The draw's limits are the rules' check's
 *  (leagueRulesCheck.ts): games a gameweek a whole number, 1 or more; more than one round robin
 *  has, it plays as many as there are (roundRobin.ts). */
export const changeSettings = mutation({
  args: { leagueId: v.id("leagues"), settings: leagueSettingsShape, revision: revisionShape },
  returns: v.number(),
  handler: (ctx, { leagueId, settings, revision }) =>
    changeLatest(ctx, leagueId, revision, (latest) => {
      const playedBy = drawRulesOf(latest);
      return {
        ...latest,
        ...(settings.oddTeamOut !== playedBy.oddTeamOut && { oddTeamOut: settings.oddTeamOut }),
        ...(settings.gamesPerGameweek !== playedBy.gamesPerGameweek && { gamesPerGameweek: settings.gamesPerGameweek }),
      };
    }),
});
