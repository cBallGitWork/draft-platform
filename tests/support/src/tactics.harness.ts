// The Tactics tab's tests' fake seam (#14): My team's fake (myTeam.harness.ts) holds it.

import { useSyncExternalStore } from "react";
import { vi } from "vitest";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import type { LineupChanges, OpenTactics, Tactics, TacticsSeam } from "../../../src/myTeam/tactics/seam";

/** The gameweek the fake server sets a lineup for, unless a test says. */
export const TACTICS_GAMEWEEK = 9;

/** An open gameweek under the first rules, with this squad and lineup: an empty squad and its
 *  empty first lineup, and no deadline, unless a test says. */
export const openTactics = (change: Partial<OpenTactics> = {}): OpenTactics => ({
  kind: "open",
  gameweek: TACTICS_GAMEWEEK,
  deadline: null,
  areaLimits: FIRST_RULES.areaLimits,
  presets: FIRST_RULES.presets,
  squad: [],
  lineup: { fromGameweek: TACTICS_GAMEWEEK, noLineup: false, starters: [], bench: [], leftSquad: [], joinedBench: [], vacated: [] },
  ...change,
});

/** What the fake server holds: the tactics, or nothing yet while they load; what a save
 *  answers, the gameweek it saved from (the tactics' by default) or the words refusing it; and
 *  whether that answer is held back until the test lets it go (`letSaveGo`), as a slow server's. */
export type TacticsData = { tactics?: Tactics; saveAnswer?: number | string; saveHeld?: boolean };

export function fakeTactics({ tactics = openTactics(), saveAnswer = TACTICS_GAMEWEEK, saveHeld = false }: TacticsData, loading: boolean) {
  let letGo: (() => void) | null = null;
  const changes = {
    save: vi.fn<LineupChanges["save"]>(async () => {
      if (saveHeld) await new Promise<void>((resolve) => (letGo = resolve));
      return saveAnswer;
    }),
  };
  // A store, so a test can change what the server holds under an open screen, as Convex would.
  let held = tactics;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  };
  return {
    useTactics: vi.fn<TacticsSeam["useTactics"]>(() => useSyncExternalStore(subscribe, () => (loading ? undefined : held))),
    /** What the server holds from now on (inside act). */
    serverHolds: (next: Tactics) => {
      held = next;
      for (const listener of listeners) listener();
    },
    /** The held save's answer lands (inside act). */
    letSaveGo: () => {
      if (letGo === null) throw new Error("No save is waiting on the fake server.");
      letGo();
      letGo = null;
    },
    useLineupChanges: vi.fn<TacticsSeam["useLineupChanges"]>(() => changes),
    lineupChanges: changes,
  };
}
