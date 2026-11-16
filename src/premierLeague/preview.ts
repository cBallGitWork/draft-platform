// The Premier League section in the preview (src/app/preview.ts): twenty clubs over a made-up season,
// the current gameweek kicked off today, with a match at full time, one live, one at half-time and
// the rest to come; earlier gameweeks finished, later ones to come; the table worked out from
// them. Made-up scores.

import { placesMoved, plTable } from "../../convex/football/plTable";
import { COMPETITION_TIE_BREAKS } from "../../convex/football/tieBreaks";
import { seasonGameweeks } from "../../convex/gameweeks/usedGameweeks";
import { previewClubs, previewDone, previewGameweek, previewSeasonGameweeks } from "../shared/preview";
import { DAY_MS, HOUR_MS, WEEK_MS } from "../../convex/shared/time";
import { previewMatch, previewMatchBeforeKickoff } from "./matchPreview";
import type { ClubPageData, ClubSquad, FirstKickoff, GameweekMatch, MatchPageData, PremierLeagueSeam, SquadGroup, SquadPlayer } from "./seam";
import { previewPlayers } from "../scouting/preview";
import { previewChanceOf } from "../myTeam/tactics/preview";
import { squadGroupOf } from "../../convex/positions/positionTables";
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
  // Each gameweek pairs the clubs afresh: a rotation, so no club meets itself. The sides swap every
  // other gameweek, so each club plays at home and away (#1966); odd ones, the current among them,
  // keep the first ten clubs at home.
  return KICKOFF_OFFSETS.map((offset, index) => {
    const pair = [CLUBS[index], CLUBS[10 + ((index + gameweek) % 10)]];
    const [home, away] = gameweek % 2 === 0 ? pair.toReversed() : pair;
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

/** A gameweek's matches, as Football lists them: every other preview reads its Premier League
 *  matches here, so a club's match is the same on every screen (#2455). */
export const previewGameweekMatches = (gameweek: number): readonly GameweekMatch[] => matches.get(gameweek) ?? [];
/** Whether `match` is one of the club's. */
export const playsIn = (clubCode: number, { home, away }: Pick<GameweekMatch, "home" | "away">) => home.code === clubCode || away.code === clubCode;
/** A club's match in a gameweek: every club plays once in each. */
export const previewClubMatch = (gameweek: number, clubCode: number): GameweekMatch | undefined =>
  previewGameweekMatches(gameweek).find((match) => playsIn(clubCode, match));
/** A club's matches still to come, soonest first, each with its gameweek. */
export const previewClubUpcoming = (clubCode: number) =>
  [...matches].flatMap(([gameweek, gameweekMatches]) =>
    gameweekMatches.filter((match) => match.score?.state === "upcoming" && playsIn(clubCode, match)).map((match) => ({ ...match, gameweek, kickoff: match.kickoff ?? 0 })),
  );
/** A match's goals at full time, home side first: its score once over, the made-up result it is
 *  heading for before then, which the matchup's replay plays it to. */
export function previewFullTimeGoals({ fixtureCode }: Pick<GameweekMatch, "fixtureCode">): readonly [number, number] {
  const [gameweek, index] = [Math.floor(fixtureCode / 100), fixtureCode % 100];
  return [goals(gameweek, index, 0), goals(gameweek, index, 1)];
}

/** The table from the made-up results by the server's own rules (plTable.ts): the current
 *  gameweek's live and half-time matches count as they stand, so it is provisional. */
const resultsOf = (played: readonly GameweekMatch[]) =>
  played.flatMap(({ home, away, score }) =>
    score === null || score.homeGoals === null || score.awayGoals === null ? [] : [{ home, away, homeGoals: score.homeGoals, awayGoals: score.awayGoals }],
  );
const results = resultsOf([...matches.values()].flat());
/** Each match's own page: its clubs, gameweek, kickoff and score as the gameweek lists them, so
 *  the score pressed is the score opened (#2450); the sheets and lines are the recorded match's
 *  alone, so none here. */
const pages = new Map(
  [...matches].flatMap(([gameweek, gameweekMatches]) =>
    gameweekMatches.map(({ fixtureCode, kickoff, home, away, score }) => {
      const page: MatchPageData = { ...previewMatchBeforeKickoff, men: [], fixtureCode, gameweek, kickoff, home, away, score: score?.state === "upcoming" ? null : score };
      return [fixtureCode, page] as const;
    }),
  ),
);
const unplayed = [...matches.values()].flat().filter(({ score }) => score?.state === "upcoming");
const tableOf = (counted: typeof results) => plTable(CLUBS, counted, { competition: COMPETITION_TIE_BREAKS.premierLeague, seasonOver: false, unplayed });
const rows = tableOf(results);
/** The current gameweek is live: each club's places moved since it began, by the server's rule
 *  (plStandings.ts), the table again without its matches. */
const before = resultsOf([...matches].flatMap(([gameweek, gameweekMatches]) => (gameweek === CURRENT ? [] : gameweekMatches)));
const moved = placesMoved(tableOf(before), rows);
const standings = {
  rows: rows.map((row) => ({ ...row, moved: moved.get(row.club) ?? 0 })),
  provisional: true,
  liveGameweek: CURRENT,
};

export const previewPremierLeague: PremierLeagueSeam = {
  useGameweeks: () => ({ seasonGameweeks: previewSeasonGameweeks, firstKickoffs }),
  useGameweekMatches: (gameweek) => matches.get(gameweek) ?? [],
  // Each fixture opens its own page; the recorded match (matchPreview.ts) opens by its own code.
  useMatch: (_leagueId, _now, fixtureCode) => pages.get(fixtureCode) ?? (fixtureCode === previewMatch.fixtureCode ? previewMatch : null),
  useStandings: () => standings,
  useClub: (_leagueId, clubCode) => previewClub(clubCode),
  useClubSquad: (_leagueId, clubCode) => previewClubSquad(clubCode),
  // The preview changes nothing: the mark goes through as if saved.
  useAbandonedMark: () => previewDone,
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
/** A row for a preview player SQUAD_ROWS leaves out, made up from his code, his doubt My team's. */
const madeUpRow = (code: number, positions: SquadPlayer["positions"]): (typeof SQUAD_ROWS)[number] => ({
  group: squadGroupOf(positions),
  lastGameweeks: [0, 1, 2, 3, 4].map((week) => (code * 5 + week * 3) % 13),
  starts: 4 + (code % 6),
  minutes: 500 + ((code * 37) % 310),
  chanceOfPlaying: previewChanceOf(code),
});
const SQUAD_GROUP_ORDER: readonly (SquadGroup | null)[] = ["GK", "DEF", "MID", "AM", "FWD", null];

/** A club's Squad tab from Scouting's preview players at it: his season points the five gameweeks
 *  added up, Waivers where Scouting has him on them. */
function previewClubSquad(clubCode: number): ClubSquad | null {
  if (!CLUBS.some(({ code }) => code === clubCode)) return null;
  const players: SquadPlayer[] = previewPlayers
    .filter(({ club }) => club.code === clubCode)
    .map(({ code, name, fullName, positions, ownerTeamName, onWaivers }) => {
      const row = SQUAD_ROWS[code] ?? madeUpRow(code, positions);
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
