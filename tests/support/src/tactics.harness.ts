// The Tactics tab's tests' fake seam (#14): My team's fake (myTeam.harness.ts) holds it.

import { vi } from "vitest";
import { classicFormationsOf, FIRST_RULES, instructionsOf } from "../../../convex/rules/firstRules";
import { firstPairFor } from "../../../convex/lineup/instructions";
import { cardRolesOf, pricedMatch, type MatchToPrice } from "../../../convex/lineup/roleCardShape";
import { FIRST_SCORING_WITH_ROLES } from "../../../convex/scoring/draftedRoleAdjustments";
import type { LineupChanges, OpenTactics, Plan, PlanChanges, Tactics, TacticsSeam } from "../../../src/myTeam/tactics/seam";
import { serverStore } from "./serverStore";

/** The gameweek the fake server sets a lineup for, unless a test says. */
export const TACTICS_GAMEWEEK = 9;

/** The team instructions the fake server holds in force, unless a test says: a back four's first
 *  defaults, Play out from the back and Keep it tight early. A save sends them with the lineup. */
export const OPEN_PICKED = firstPairFor([]);

/** An open gameweek under the first rules, with this squad and lineup: an empty squad and its
 *  empty first lineup, and no deadline, unless a test says. */
export const openTactics = (change: Partial<OpenTactics> = {}): OpenTactics => ({
  kind: "open",
  gameweek: TACTICS_GAMEWEEK,
  deadline: null,
  areaLimits: FIRST_RULES.areaLimits,
  presets: FIRST_RULES.presets,
  classicFormations: classicFormationsOf(FIRST_RULES),
  instructions: [...instructionsOf(FIRST_RULES)],
  picked: OPEN_PICKED,
  squad: [],
  lineup: { fromGameweek: TACTICS_GAMEWEEK, starters: [], bench: [], leftSquad: [], joinedBench: [], vacated: [] },
  ...change,
});

/** What the fake server holds: the tactics, or nothing yet while they load; what a save
 *  answers, the gameweek it saved from (the tactics' by default) or the words refusing it; and
 *  whether that answer is held back until the test lets it go (`letSaveGo`), as a slow server's;
 *  the saved plans, or nothing yet while they load (`plansLoading`). */
export type TacticsData = {
  tactics?: Tactics;
  saveAnswer?: number | string;
  saveHeld?: boolean;
  plans?: readonly Plan[];
  plansLoading?: boolean;
  planAnswer?: string | null;
  /** Every player's last matches played, which his role card prices as the server does (#848):
   *  none unless a test says. */
  cardMatches?: readonly MatchToPrice[];
};

export function fakeTactics(
  { tactics = openTactics(), saveAnswer = TACTICS_GAMEWEEK, saveHeld = false, plans = [], plansLoading = false, planAnswer = null, cardMatches = [] }: TacticsData,
  loading: boolean,
) {
  let letGo: (() => void) | null = null;
  const changes = {
    save: vi.fn<LineupChanges["save"]>(async () => {
      if (saveHeld) await new Promise<void>((resolve) => (letGo = resolve));
      return saveAnswer;
    }),
  };
  const held = serverStore(tactics);
  // The saved plans: a save the fake doesn't refuse (`planAnswer`) adds one or replaces it by name.
  const heldPlans = serverStore(plans);
  const planChanges = {
    save: vi.fn<PlanChanges["save"]>(async (_leagueId, name, slots) => {
      if (planAnswer !== null) return planAnswer;
      const saved = heldPlans.get();
      const kept = saved.some((plan) => plan.name === name);
      heldPlans.set(kept ? saved.map((plan) => (plan.name === name ? { name, slots } : plan)) : [...saved, { name, slots }]);
      return null;
    }),
    remove: vi.fn<PlanChanges["remove"]>(async (_leagueId, name) => {
      heldPlans.set(heldPlans.get().filter((plan) => plan.name !== name));
      return null;
    }),
  };
  return {
    useTactics: vi.fn<TacticsSeam["useTactics"]>(() => held.use((now) => (loading ? undefined : now))),
    /** What the server holds from now on. */
    serverHolds: held.set,
    /** The held save's answer lands (inside act). */
    letSaveGo: () => {
      if (letGo === null) throw new Error("No save is waiting on the fake server.");
      letGo();
      letGo = null;
    },
    useLineupChanges: vi.fn<TacticsSeam["useLineupChanges"]>(() => changes),
    useTacticsOpened: vi.fn<TacticsSeam["useTacticsOpened"]>(),
    useRoleCard: vi.fn<TacticsSeam["useRoleCard"]>((_leagueId, playerCode, cell, formation) => {
      if (loading) return undefined;
      const now = held.get();
      const positions = (now.kind === "open" ? now.squad : []).find((member) => member.playerCode === playerCode)?.positions ?? [];
      const roles = cardRolesOf(cell, formation, positions, FIRST_SCORING_WITH_ROLES);
      return { roles, matches: cardMatches.map((match) => pricedMatch(match, cell, roles.map(({ key }) => key))) };
    }),
    usePlans: vi.fn<TacticsSeam["usePlans"]>(() => heldPlans.use((saved) => (loading || plansLoading ? undefined : saved))),
    usePlanChanges: vi.fn<TacticsSeam["usePlanChanges"]>(() => planChanges),
    lineupChanges: changes,
    planChanges,
  };
}
