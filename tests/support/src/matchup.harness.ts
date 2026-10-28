// The matchup's tests' fake seam (shell.harness.tsx hands it to the app).

import { act } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { MatchupCommentary, MatchupSide, MatchupSlot } from "../../../convex/matchup/matchupShape";
import type { Matchup, MatchupSeam } from "../../../src/matchup/seam";

/** A matchup the test moves on, as Convex's live query would: each `play` re-renders the screen. */
export function liveMatchup(first: Matchup | undefined) {
  let current = first;
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get: () => current,
    play: (next: Matchup | undefined) => {
      current = next;
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

/** What the fake server holds: the matchup, null for a league with no rules, nothing yet while it
 *  loads, or a `live` one the test moves on. A league in total points by default. */
export type MatchupData = { matchup?: Matchup | null; loading?: boolean; live?: ReturnType<typeof liveMatchup> };

export function fakeMatchup({ matchup = { kind: "totalPoints" }, loading = false, live }: MatchupData = {}) {
  return {
    useMatchup: vi.fn<MatchupSeam["useMatchup"]>(() =>
      // `live` is fixed for the fake's life, so each render calls the same hooks.
      live === undefined ? (loading ? undefined : matchup) : useSyncExternalStore(live.subscribe, live.get),
    ),
  };
}

type HeadToHead = Extract<Matchup, { kind: "headToHead" }>;
type Side = Extract<MatchupSide, { kind: "team" }>;
type Slot = MatchupSlot;

/** FPL's code for the match a made-up man plays in, unless his status names another. */
export const SLOT_MATCH = 101;

/** A man in a lineup, yet to play and counting unless `rest` says. */
export const slot = (name: string, rest: Partial<Slot> = {}): Slot => ({
  playerCode: [...name].reduce((code, letter) => code * 31 + letter.charCodeAt(0), 7),
  name,
  area: "midfield",
  points: null,
  counts: true,
  provisional: true,
  status: { kind: "yetToPlay", fixtureCode: SLOT_MATCH, kickoff: null },
  autoSub: null,
  ...rest,
});

/** A team's side: its starters and bench, its total and whether that is provisional. */
export const teamSide = (teamName: string, starters: Slot[], bench: Slot[], points = 0, provisional = true): Side => ({
  kind: "team",
  teamId: `team-${teamName}` as Id<"teams">,
  teamName,
  points,
  provisional,
  lineup: { starters, bench },
});

type Game = HeadToHead["game"];
type Scored = Extract<Game, { kind: "scored" }>;

/** Commentary with no lines yet, keeping up: what a scored game holds unless a test says. */
export const NO_COMMENTARY: MatchupCommentary = { kind: "read", lines: [], delayed: false };

/** Team 1's matchup in `gameweek`, of the gameweeks it plays, holding `game`; a scored one with no
 *  commentary unless it gives some. */
export const headToHead = (
  game: Exclude<Game, Scored> | (Omit<Scored, "commentary"> & { commentary?: MatchupCommentary }),
  { gameweek = 6, gameweeks = [5, 6, 7], deadline = null as number | null } = {},
): HeadToHead => ({
  kind: "headToHead",
  teamId: "team-Team 1" as Id<"teams">,
  teamName: "Team 1",
  gameweeks,
  gameweek,
  deadline,
  game: game.kind === "scored" ? { commentary: NO_COMMENTARY, ...game } : game,
});
