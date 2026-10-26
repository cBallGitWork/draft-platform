// The Tactics tab's tests' fake seam (#14): My team's fake (myTeam.harness.ts) holds it.

import { vi } from "vitest";
import { FIRST_RULES } from "../../../convex/rules/firstRules";
import type { LineupChanges, OpenTactics, Tactics, TacticsSeam } from "../../../src/myTeam/tacticsSeam";

/** The gameweek the fake server sets a lineup for, unless a test says. */
export const TACTICS_GAMEWEEK = 9;

/** An open gameweek under the first rules, with this squad and lineup: an empty squad that has
 *  never saved one, and no deadline, unless a test says. */
export const openTactics = (change: Partial<OpenTactics> = {}): OpenTactics => ({
  kind: "open",
  gameweek: TACTICS_GAMEWEEK,
  deadline: null,
  areaLimits: FIRST_RULES.areaLimits,
  presets: FIRST_RULES.presets,
  squad: [],
  lineup: { kind: "none" },
  ...change,
});

/** What the fake server holds: the tactics, or nothing yet while they load; and what a save
 *  answers, saved by default. */
export type TacticsData = { tactics?: Tactics; saveAnswer?: string | null };

export function fakeTactics({ tactics = openTactics(), saveAnswer = null }: TacticsData, loading: boolean) {
  const changes = { save: vi.fn<LineupChanges["save"]>(async () => saveAnswer) };
  return {
    useTactics: vi.fn<TacticsSeam["useTactics"]>(() => (loading ? undefined : tactics)),
    useLineupChanges: vi.fn<TacticsSeam["useLineupChanges"]>(() => changes),
    lineupChanges: changes,
  };
}
