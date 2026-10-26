// The Premier League section in the preview (src/preview.ts): twenty clubs over a made-up season,
// the current gameweek kicked off today, with a match at full time, one live, one at half-time and
// the rest to come; earlier gameweeks finished, later ones to come. Made-up scores.

import { SEASON_GAMEWEEKS } from "../../convex/gameweeks/usedGameweeks";
import { HOUR_MS, WEEK_MS } from "../../convex/shared/time";
import type { FirstKickoff, GameweekMatch, PremierLeagueSeam } from "./seam";

const CLUBS = [
  ["Arsenal", "ARS"],
  ["Aston Villa", "AVL"],
  ["Bournemouth", "BOU"],
  ["Brentford", "BRE"],
  ["Brighton", "BHA"],
  ["Chelsea", "CHE"],
  ["Coventry City", "COV"],
  ["Crystal Palace", "CRY"],
  ["Everton", "EVE"],
  ["Fulham", "FUL"],
  ["Ipswich Town", "IPS"],
  ["Leeds United", "LEE"],
  ["Liverpool", "LIV"],
  ["Man City", "MCI"],
  ["Man Utd", "MUN"],
  ["Newcastle", "NEW"],
  ["Nottingham Forest", "NFO"],
  ["Spurs", "TOT"],
  ["West Ham", "WHU"],
  ["Wolves", "WOL"],
].map(([name, shortName], index) => ({ code: index + 1, name, shortName }));

const CURRENT = 9;
/** The current gameweek's first kickoff, two hours ago; each gameweek a week apart. */
const currentStart = Date.now() - 2 * HOUR_MS;
const startOf = (gameweek: number) => currentStart + (gameweek - CURRENT) * WEEK_MS;
/** How many hours after its start each of a gameweek's ten matches kicks off: over four days. */
const KICKOFF_OFFSETS = [0, 2.5, 2.5, 2.5, 2.5, 5, 24, 26.5, 29, 72].map((hours) => hours * HOUR_MS);

/** The current gameweek's states, match by match; the rest of it is to come. */
const CURRENT_STATES = [
  { state: "fullTime", minutes: 90, clockLabel: null },
  { state: "live", minutes: 67, clockLabel: "67'12" },
  { state: "halfTime", minutes: 45, clockLabel: "45+2'00" },
] as const;

const goals = (gameweek: number, index: number, side: number) => (gameweek * 3 + index * 5 + side * 7) % 4;

function matchesOf(gameweek: number): GameweekMatch[] {
  // Each gameweek pairs the clubs afresh: a rotation, so no club meets itself.
  return KICKOFF_OFFSETS.map((offset, index) => {
    const home = CLUBS[index];
    const away = CLUBS[10 + ((index + gameweek) % 10)];
    const fixtureCode = gameweek * 100 + index;
    const kickoff = startOf(gameweek) + offset;
    const finished = gameweek < CURRENT;
    const current = gameweek === CURRENT ? CURRENT_STATES[index] : undefined;
    const score =
      finished || current
        ? {
            state: current?.state ?? "fullTime",
            homeGoals: goals(gameweek, index, 0),
            awayGoals: goals(gameweek, index, 1),
            minutes: current?.minutes ?? 90,
            clockLabel: current?.clockLabel ?? null,
          }
        : { state: "upcoming" as const, homeGoals: null, awayGoals: null, minutes: null, clockLabel: null };
    return { fixtureCode, kickoff, home, away, score };
  });
}

const firstKickoffs: FirstKickoff[] = SEASON_GAMEWEEKS.map((gameweek) => ({
  gameweek,
  firstKickoff: startOf(gameweek),
}));
const matches = new Map(SEASON_GAMEWEEKS.map((gameweek) => [gameweek, matchesOf(gameweek)]));

export const previewPremierLeague: PremierLeagueSeam = {
  useFirstKickoffs: () => firstKickoffs,
  useGameweekMatches: (gameweek) => matches.get(gameweek) ?? [],
};
