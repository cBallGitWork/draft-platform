// The Premier League section in the preview (src/app/preview.ts): twenty clubs over a made-up season,
// the current gameweek kicked off today, with a match at full time, one live, one at half-time and
// the rest to come; earlier gameweeks finished, later ones to come; the table worked out from
// them. Made-up scores.

import { plTable } from "../../convex/football/plTable";
import { COMPETITION_TIE_BREAKS } from "../../convex/football/tieBreaks";
import { seasonGameweeks } from "../../convex/gameweeks/usedGameweeks";
import { previewClubs, previewGameweek, previewSeasonGameweeks } from "../shared/preview";
import { DAY_MS, HOUR_MS, WEEK_MS } from "../../convex/shared/time";
import { previewMatch, previewMatchBeforeKickoff } from "./matchPreview";
import type { ClubPageData, ClubSquad, FirstKickoff, GameweekMatch, PremierLeagueSeam, SquadGroup, SquadPlayer } from "./seam";
import { previewPlayers } from "../scouting/preview";
import { clubPageOf, type HeldMatch } from "../../convex/football/clubFixtures";

const CLUBS = previewClubs;

const CURRENT = previewGameweek;
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

const SEASON = seasonGameweeks(previewSeasonGameweeks);
const firstKickoffs: FirstKickoff[] = SEASON.map((gameweek) => ({
  gameweek,
  firstKickoff: startOf(gameweek),
}));
const matches = new Map(SEASON.map((gameweek) => [gameweek, matchesOf(gameweek)]));

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
  rows: plTable(CLUBS, results, { competition: COMPETITION_TIE_BREAKS.premierLeague, seasonOver: false, unplayed }),
  provisional: true,
};

export const previewPremierLeague: PremierLeagueSeam = {
  useGameweeks: () => ({ seasonGameweeks: previewSeasonGameweeks, firstKickoffs }),
  useGameweekMatches: (gameweek) => matches.get(gameweek) ?? [],
  // Every fixture opens the one recorded match (matchPreview.ts): one to come, as before kickoff.
  useMatch: (_leagueId, _now, fixtureCode) => upcoming.get(fixtureCode) ?? previewMatch,
  useStandings: () => standings,
  useClub: (_leagueId, clubCode) => previewClub(clubCode),
  useClubSquad: (_leagueId, clubCode) => previewClubSquad(clubCode),
};

/** Each preview player's made-up row on his club's Squad tab, by his code (Scouting's preview
 *  players): his group, his points in the last five gameweeks, his starts, minutes and doubt. */
const SQUAD_ROWS: Record<number, Pick<SquadPlayer, "group" | "lastGameweeks" | "starts" | "minutes" | "chanceOfPlaying">> = {
  1: { group: "AM", lastGameweeks: [8, 2, null, 12, 5], starts: 8, minutes: 720, chanceOfPlaying: 75 },
  2: { group: "MID", lastGameweeks: [3, 6, 2, 4, 3], starts: 9, minutes: 810, chanceOfPlaying: null },
  3: { group: "GK", lastGameweeks: [6, 1, 7, 2, 6], starts: 9, minutes: 810, chanceOfPlaying: null },
  4: { group: "AM", lastGameweeks: [10, 2, 9, 3, 15], starts: 9, minutes: 765, chanceOfPlaying: null },
  5: { group: "DEF", lastGameweeks: [null, 1, 2, null, 6], starts: 5, minutes: 430, chanceOfPlaying: 25 },
  6: { group: "AM", lastGameweeks: [13, 2, 8, 9, 2], starts: 9, minutes: 800, chanceOfPlaying: null },
  7: { group: "DEF", lastGameweeks: [6, 1, 2, 6, 1], starts: 9, minutes: 810, chanceOfPlaying: null },
};
const SQUAD_GROUP_ORDER: readonly (SquadGroup | null)[] = ["GK", "DEF", "MID", "AM", "FWD", null];

/** A club's Squad tab from Scouting's preview players at it: his season points the five gameweeks
 *  added up, Waivers where Scouting has him on them. */
function previewClubSquad(clubCode: number): ClubSquad | null {
  if (!CLUBS.some(({ code }) => code === clubCode)) return null;
  const players: SquadPlayer[] = previewPlayers
    .filter(({ club }) => club.code === clubCode)
    .map(({ code, name, fullName, positions, ownerTeamName, onWaivers }) => {
      const row = SQUAD_ROWS[code];
      return { code, name, fullName, positions, ownerTeamName, onWaivers: onWaivers !== null, seasonPoints: row.lastGameweeks.reduce<number>((sum, points) => sum + (points ?? 0), 0), ...row };
    })
    .toSorted((one, other) => SQUAD_GROUP_ORDER.indexOf(one.group) - SQUAD_GROUP_ORDER.indexOf(other.group) || one.name.localeCompare(other.name));
  const topScorers = players
    .toSorted((one, other) => (other.seasonPoints ?? 0) - (one.seasonPoints ?? 0))
    .slice(0, 3)
    .map(({ code, name, seasonPoints }) => ({ code, name, seasonPoints: seasonPoints ?? 0 }));
  // The current gameweek is under way, so the five before it are the last finished.
  const gameweeks = [5, 4, 3, 2, 1].map((back) => CURRENT - back);
  return { gameweeks, pointsSeason: null, players, topScorers };
}

/** A club's page from the made-up season, by the server's own rules (clubFixtures.ts). */
const heldMatches: HeldMatch[] = [...matches].flatMap(([gameweek, gameweekMatches]) => gameweekMatches.map((match) => ({ ...match, gameweek })));
const positionOf = (code: number) => standings.rows.find(({ club }) => club.code === code)?.position ?? null;
function previewClub(clubCode: number): ClubPageData | null {
  const club = CLUBS.find(({ code }) => code === clubCode);
  return club === undefined ? null : clubPageOf(club, heldMatches, positionOf);
}
