// The Premier League section's tests' fake seam (shell.harness.tsx hands it to the app).

import { act } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { vi } from "vitest";
import type { FirstKickoff, GameweekMatch, MatchPage, PlStandings, PremierLeagueSeam } from "../../../src/premierLeague/seam";

export { ARSENAL, CHELSEA } from "../convex/footballRows.harness";
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
  standings?: PlStandings;
  /** The match page's match, whichever fixture is asked for; null for none held. */
  match?: MatchPage | null;
  loading?: boolean;
};

/** The fake seam, whose matches and table a test can change as a live query would (`send`,
 *  `sendStandings`): each screen reading them draws again. */
export function fakePremierLeague({ firstKickoffs = [], matches = {}, standings = NO_STANDINGS, match = null, loading = false }: PremierLeagueData = {}) {
  let held: Record<number, GameweekMatch[] | undefined> = { ...matches };
  let heldStandings = standings;
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
    useStandings: vi.fn<PremierLeagueSeam["useStandings"]>(() =>
      useSyncExternalStore(subscribe, () => (loading ? undefined : heldStandings)),
    ),
    useMatch: vi.fn<PremierLeagueSeam["useMatch"]>(() => (loading ? undefined : match)),
    /** The server's new read of a gameweek's matches; undefined puts them back to loading. */
    send(gameweek: number, sent: GameweekMatch[] | undefined) {
      held = { ...held, [gameweek]: sent };
      act(() => listeners.forEach((listener) => listener()));
    },
    /** The server's new read of the table. */
    sendStandings(sent: PlStandings) {
      heldStandings = sent;
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

/** One empty list, so the store hands back the same value until something is sent. */
const NO_MATCHES: GameweekMatch[] = [];

type StandingsRow = PlStandings["rows"][number];
/** A table row for `club` at `position`, played nothing unless `rest` says. */
export const standingsRow = (position: number, club: StandingsRow["club"], rest: Partial<StandingsRow> = {}): StandingsRow => ({
  club,
  position,
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDifference: 0,
  points: 0,
  ...rest,
});

/** No club held yet. */
const NO_STANDINGS: PlStandings = { rows: [], provisional: false };
