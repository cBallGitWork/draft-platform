// The seam for League settings: what the screen reads of a league's settings and asks of them.
// Convex fills it in live (liveSettings.ts); the preview and the tests hand the screen their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSettings } from "../../convex/rules/leagueSettingsPart";
import type { Revision, RulesView } from "../rules/rulesDraft";

export type SettingsView = RulesView<LeagueSettings>;

export type LeagueSettingsSeam = {
  /** Live (a hook): undefined while it loads, null for a league made before leagues held rules. */
  useSettings(leagueId: Id<"leagues">): SettingsView | null | undefined;
  /** Saves the settings, edited from the rules `revision` names: resolves with the gameweek they
   *  take effect from, or the words saying why not. It never rejects. */
  save(leagueId: Id<"leagues">, settings: LeagueSettings, revision: Revision): Promise<number | string>;
};
