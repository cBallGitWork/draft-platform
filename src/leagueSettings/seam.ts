// The seam for League settings: what the screen reads of a league's settings and asks of them.
// Convex fills it in live (liveSettings.ts); the preview and the tests hand the screen their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { ScoringStartView } from "../../convex/gameweeks/scoringStart";
import type { LeagueSettings } from "../../convex/rules/leagueSettingsPart";
import type { Revision, RulesView } from "../rules/rulesEdits";
import type { Change } from "../shared/refusal";
import type { ClaimsSeam } from "../myTeam/claims/seam";

export type SettingsView = RulesView<LeagueSettings>;

export type LeagueSettingsSeam = {
  /** Live (a hook): undefined while it loads. */
  useSettings(leagueId: Id<"leagues">): SettingsView | undefined;
  /** Saves the settings, edited from the rules `revision` names: resolves with the gameweek they
   *  take effect from, or the words saying why not. It never rejects. */
  save(leagueId: Id<"leagues">, settings: LeagueSettings, revision: Revision): Promise<number | string>;
  /** Live (a hook): the draft order and whether the draft has started; undefined while it loads. */
  useTeamOrder(leagueId: Id<"leagues">): TeamOrder | undefined;
  /** Saves the commissioner's draft order: resolves with null once saved, or the words saying why
   *  not. It never rejects. */
  saveTeamOrder(leagueId: Id<"leagues">, teamIds: Id<"teams">[]): Change;
  /** Draws the draft order at random from the league's teams now and saves it: resolves with null
   *  once saved, or the words saying why not. It never rejects. */
  drawTeamOrder(leagueId: Id<"leagues">): Change;
  /** Live (a hook): the league's scoring start and its ticked gameweeks; undefined while it loads. */
  useScoringStart(leagueId: Id<"leagues">): ScoringStartView | undefined;
  /** Sets the gameweek scoring starts in: resolves with null once saved, or the words saying why
   *  not. It never rejects. */
  setScoringStart(leagueId: Id<"leagues">, gameweek: number): Change;
  /** The waiver order and the runs, as My team's Transactions tab reads them (#1200). */
  useWaivers: ClaimsSeam["useWaivers"];
  /** Every team's pending claims, as My team's Transactions tab reads them, for a commissioner
   *  with no team and so no Transactions tab (#1487). */
  usePendingClaims: ClaimsSeam["usePendingClaims"];
};

/** A team in the draft order (convex/draft/draftOrder.ts). */
export type TeamInOrder = { teamId: Id<"teams">; name: string };

/** The draft order, first pick first, and whether the draft has started, which fixes it. */
export type TeamOrder = { teams: TeamInOrder[]; started: boolean };
