// The Premier League section in the preview (src/app/preview.ts): twenty clubs over a made-up season,
// the current gameweek kicked off today, with a match at full time, one live, one at half-time and
// the rest to come; earlier gameweeks finished, later ones to come; the table worked out from
// them. Made-up scores.

import { plTable } from "../../convex/football/plTable";
import { COMPETITION_TIE_BREAKS } from "../../convex/football/tieBreaks";
import { SEASON_GAMEWEEKS } from "../../convex/gameweeks/usedGameweeks";
import { DAY_MS, HOUR_MS, WEEK_MS } from "../../convex/shared/time";
import { previewMatch, previewMatchBeforeKickoff } from "./matchPreview";
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
/** The current gameweek's first kickoff: 12:30 today, or yesterday before 14:30, so its first
 *  match is always under way or over; each gameweek a week apart. */
const today = new Date();
today.setHours(12, 30, 0, 0);
const currentStart = today.getTime() - (Date.now() < today.getTime() + 2 * HOUR_MS ? DAY_MS : 0);
const startOf = (gameweek: number) => currentStart + (gameweek - CURRENT) * WEEK_MS;
/** How many hours after its 12:30 start each of a gameweek's ten matches kicks off, a Saturday's
 *  12:30, 15:00 and 17:30, then the next day's 14:00 and 16:30, and Monday's 20:00. */
const KICKOFF_OFFSETS = [0, 2.5, 2.5, 2.5, 2.5, 5, 25.5, 25.5, 28, 55.5].map((hours) => hours * HOUR_MS);

/** The current gameweek's states, match by match; the rest of it is to come. */
const CURRENT_STATES = [
  { state: "fullTime", minutes: 90, clockLabel: null },
  { state: "live", minutes: 67, clockLabel: "67'12" },
  { state: "halfTime", minutes: 45, clockLabel: "45+2'00" },
] as const;

const goals = (gameweek: number, index: number, side: number) => (gameweek * 3 + index * 5 + side * 7) % 4;

/** The preview's code for a gameweek's match, by its place in the gameweek. */
export const previewFixtureCode = (gameweek: number, index: number) => gameweek * 100 + index;

function matchesOf(gameweek: number): GameweekMatch[] {
  // Each gameweek pairs the clubs afresh: a rotation, so no club meets itself.
  return KICKOFF_OFFSETS.map((offset, index) => {
    const home = CLUBS[index];
    const away = CLUBS[10 + ((index + gameweek) % 10)];
    const fixtureCode = previewFixtureCode(gameweek, index);
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

/** The table from the made-up results by the server's own rules (plTable.ts): the current
 *  gameweek's live and half-time matches count as they stand, so it is provisional. */
const results = [...matches.values()].flat().flatMap(({ home, away, score }) =>
  score === null || score.homeGoals === null || score.awayGoals === null ? [] : [{ home, away, homeGoals: score.homeGoals, awayGoals: score.awayGoals }],
);
/** Each match still to come, opening the recorded match as it stood before kickoff, on its own
 *  day and in its own gameweek. */
const upcoming = new Map(
  [...matches].flatMap(([gameweek, gameweekMatches]) =>
    gameweekMatches.flatMap(({ fixtureCode, kickoff, score }) =>
      score?.state === "upcoming" ? [[fixtureCode, { ...previewMatchBeforeKickoff, fixtureCode, gameweek, kickoff }] as const] : [],
    ),
  ),
);
const unplayed = [...matches.values()].flat().filter(({ score }) => score?.state === "upcoming");
const standings = {
  rows: plTable(CLUBS, results, { tieBreaks: COMPETITION_TIE_BREAKS.premierLeague, unplayed }),
  provisional: true,
};

export const previewPremierLeague: PremierLeagueSeam = {
  useFirstKickoffs: () => firstKickoffs,
  useGameweekMatches: (gameweek) => matches.get(gameweek) ?? [],
  // Every fixture opens the one recorded match (matchPreview.ts): one to come, as before kickoff.
  useMatch: (_leagueId, fixtureCode) => upcoming.get(fixtureCode) ?? previewMatch,
  useStandings: () => standings,
};
