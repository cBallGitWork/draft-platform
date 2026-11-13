// The Premier League section's tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { ClubPageData, FirstKickoff, GameweekMatch, MatchPageData, PlStandings, PremierLeagueSeam } from "../../../src/premierLeague/seam";

import { PL_GAMEWEEKS } from "../convex/footballRows.harness";
import { serverStore } from "./serverStore";

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

/** What the fake server holds: how many gameweeks the season has (PL_GAMEWEEKS unless said), each
 *  gameweek's first kickoff, and each gameweek's matches (none for a gameweek not named); `loading`
 *  keeps both on their way. */
export type PremierLeagueData = {
  seasonGameweeks?: number;
  firstKickoffs?: FirstKickoff[];
  matches?: Record<number, GameweekMatch[]>;
  standings?: PlStandings;
  /** The match page's match, whichever fixture is asked for; null for none held. */
  match?: MatchPageData | null;
  /** The club page's club, whichever club is asked for; null for none held. */
  club?: ClubPageData | null;
  loading?: boolean;
};

/** The fake seam, whose matches and table a test can change as a live query would (`send`,
 *  `sendStandings`): each screen reading them draws again. */
export function fakePremierLeague({ seasonGameweeks = PL_GAMEWEEKS, firstKickoffs = [], matches = {}, standings = NO_STANDINGS, match = null, club = null, loading = false }: PremierLeagueData = {}) {
  const held = serverStore<Record<number, GameweekMatch[] | undefined>>({ ...matches });
  const heldStandings = serverStore(standings);
  return {
    useGameweeks: vi.fn<PremierLeagueSeam["useGameweeks"]>(() => (loading ? undefined : { seasonGameweeks, firstKickoffs })),
    useGameweekMatches: vi.fn<PremierLeagueSeam["useGameweekMatches"]>((gameweek) =>
      held.use((byGameweek) => (loading ? undefined : gameweek in byGameweek ? byGameweek[gameweek] : NO_MATCHES)),
    ),
    useStandings: vi.fn<PremierLeagueSeam["useStandings"]>(() => heldStandings.use((table) => (loading ? undefined : table))),
    useMatch: vi.fn<PremierLeagueSeam["useMatch"]>(() => (loading ? undefined : match)),
    useClub: vi.fn<PremierLeagueSeam["useClub"]>(() => (loading ? undefined : club)),
    /** The server's new read of a gameweek's matches; undefined puts them back to loading. */
    send: (gameweek: number, sent: GameweekMatch[] | undefined) => held.set({ ...held.get(), [gameweek]: sent }),
    /** The server's new read of the table. */
    sendStandings: heldStandings.set,
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
  moved: null,
  ...rest,
});

/** No club held yet. */
const NO_STANDINGS: PlStandings = { rows: [], provisional: false, liveGameweek: null };
