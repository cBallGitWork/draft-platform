// The Tactics tab's tests' fake seam (#14): My team's fake (myTeam.harness.ts) holds it.

import { useSyncExternalStore } from "react";
import { vi } from "vitest";
import { classicsOf, FIRST_RULES, instructionsOf } from "../../../convex/rules/firstRules";
import { firstPairFor } from "../../../convex/lineup/instructions";
import type { LineupChanges, OpenTactics, Plan, PlanChanges, Tactics, TacticsSeam } from "../../../src/myTeam/tactics/seam";

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
  classics: classicsOf(FIRST_RULES),
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
export type TacticsData = { tactics?: Tactics; saveAnswer?: number | string; saveHeld?: boolean; plans?: readonly Plan[]; plansLoading?: boolean; planAnswer?: string | null };

export function fakeTactics(
  { tactics = openTactics(), saveAnswer = TACTICS_GAMEWEEK, saveHeld = false, plans = [], plansLoading = false, planAnswer = null }: TacticsData,
  loading: boolean,
) {
  let letGo: (() => void) | null = null;
  const changes = {
    save: vi.fn<LineupChanges["save"]>(async () => {
      if (saveHeld) await new Promise<void>((resolve) => (letGo = resolve));
      return saveAnswer;
    }),
  };
  // A store, so a test can change what the server holds under an open screen, as Convex would.
  let held = tactics;
  // The saved plans: a save the fake doesn't refuse (`planAnswer`) adds one or replaces it by name.
  let heldPlans = plans;
  const listeners = new Set<() => void>();
  const tell = () => {
    for (const listener of listeners) listener();
  };
  const planChanges = {
    save: vi.fn<PlanChanges["save"]>(async (_leagueId, name, slots) => {
      if (planAnswer !== null) return planAnswer;
      const kept = heldPlans.some((plan) => plan.name === name);
      heldPlans = kept ? heldPlans.map((plan) => (plan.name === name ? { name, slots } : plan)) : [...heldPlans, { name, slots }];
      tell();
      return null;
    }),
    remove: vi.fn<PlanChanges["remove"]>(async (_leagueId, name) => {
      heldPlans = heldPlans.filter((plan) => plan.name !== name);
      tell();
      return null;
    }),
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  };
  return {
    useTactics: vi.fn<TacticsSeam["useTactics"]>(() => useSyncExternalStore(subscribe, () => (loading ? undefined : held))),
    /** What the server holds from now on (inside act). */
    serverHolds: (next: Tactics) => {
      held = next;
      tell();
    },
    /** The held save's answer lands (inside act). */
    letSaveGo: () => {
      if (letGo === null) throw new Error("No save is waiting on the fake server.");
      letGo();
      letGo = null;
    },
    useLineupChanges: vi.fn<TacticsSeam["useLineupChanges"]>(() => changes),
    useTacticsOpened: vi.fn<TacticsSeam["useTacticsOpened"]>(),
    usePlans: vi.fn<TacticsSeam["usePlans"]>(() => useSyncExternalStore(subscribe, () => (loading || plansLoading ? undefined : heldPlans))),
    usePlanChanges: vi.fn<TacticsSeam["usePlanChanges"]>(() => planChanges),
    lineupChanges: changes,
    planChanges,
  };
}
