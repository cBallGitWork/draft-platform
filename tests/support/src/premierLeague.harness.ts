// The Premier League section's tests' fake seam (shell.harness.tsx hands it to the app).

import { act } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { vi } from "vitest";
import type { FirstKickoff, GameweekMatch, PremierLeagueSeam } from "../../../src/premierLeague/seam";

export const ARSENAL = { code: 3, name: "Arsenal", shortName: "ARS" };
export const CHELSEA = { code: 8, name: "Chelsea", shortName: "CHE" };
export const FOREST = { code: 17, name: "Nottingham Forest", shortName: "NFO" };
export const SPURS = { code: 6, name: "Spurs", shortName: "TOT" };

type Score = NonNullable<GameweekMatch["score"]>;

/** A match between `home` and `away` at `kickoff`, with no score read yet unless `score` says. */
export const plMatch = (
  fixtureCode: number,
  home: GameweekMatch["home"],
  away: GameweekMatch["away"],
  kickoff: number | null,
  score: Partial<Score> | null = null,
): GameweekMatch => ({
  fixtureCode,
  kickoff,
  home,
  away,
  score: score === null ? null : { state: "upcoming", homeGoals: null, awayGoals: null, minutes: null, clockLabel: null, ...score },
});

/** What the fake server holds: each gameweek's first kickoff, and each gameweek's matches (none for
 *  a gameweek not named); `loading` keeps both on their way. */
export type PremierLeagueData = {
  firstKickoffs?: FirstKickoff[];
  matches?: Record<number, GameweekMatch[]>;
  loading?: boolean;
};

/** The fake seam, whose matches a test can change as a live query would (`send`): each screen
 *  reading them draws again. */
export function fakePremierLeague({ firstKickoffs = [], matches = {}, loading = false }: PremierLeagueData = {}) {
  let held: Record<number, GameweekMatch[] | undefined> = { ...matches };
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const heldOf = (gameweek: number) => (loading ? undefined : gameweek in held ? held[gameweek] : NO_MATCHES);
  return {
    useFirstKickoffs: vi.fn<PremierLeagueSeam["useFirstKickoffs"]>(() => (loading ? undefined : firstKickoffs)),
    useGameweekMatches: vi.fn<PremierLeagueSeam["useGameweekMatches"]>((gameweek) =>
      useSyncExternalStore(subscribe, () => heldOf(gameweek)),
    ),
    /** The server's new read of a gameweek's matches; undefined puts them back to loading. */
    send(gameweek: number, sent: GameweekMatch[] | undefined) {
      held = { ...held, [gameweek]: sent };
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

/** One empty list, so the store hands back the same value until something is sent. */
const NO_MATCHES: GameweekMatch[] = [];
