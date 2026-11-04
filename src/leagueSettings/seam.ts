// The seam for League settings: what the screen reads of a league's settings and asks of them.
// Convex fills it in live (liveSettings.ts); the preview and the tests hand the screen their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSettings } from "../../convex/rules/leagueSettingsPart";
import type { Revision, RulesView } from "../rules/rulesDraft";
import type { Change } from "../shared/refusal";

export type SettingsView = RulesView<LeagueSettings>;

export type LeagueSettingsSeam = {
  /** Live (a hook): undefined while it loads, null for a league made before leagues held rules. */
  useSettings(leagueId: Id<"leagues">): SettingsView | null | undefined;
  /** Saves the settings, edited from the rules `revision` names: resolves with the gameweek they
   *  take effect from, or the words saying why not. It never rejects. */
  save(leagueId: Id<"leagues">, settings: LeagueSettings, revision: Revision): Promise<number | string>;
  /** Live (a hook): the commissioner's draft order, first pick first; undefined while it loads. */
  useTeamOrder(leagueId: Id<"leagues">): TeamInOrder[] | undefined;
  /** Saves the commissioner's draft order: resolves with null once saved, or the words saying why
   *  not. It never rejects. */
  saveTeamOrder(leagueId: Id<"leagues">, teamIds: Id<"teams">[]): Change;
  /** Draws the draft order at random from the league's teams now and saves it: resolves with null
   *  once saved, or the words saying why not. It never rejects. */
  drawTeamOrder(leagueId: Id<"leagues">): Change;
};

/** A team in the draft order (convex/draft/draftOrder.ts). */
export type TeamInOrder = { teamId: Id<"teams">; name: string };
