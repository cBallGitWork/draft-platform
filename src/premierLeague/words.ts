// What the Premier League section says, in one place for Craig to change in the pull request.

import { LOCALE } from "../../convex/shared/moments";
import { gameweekWords } from "../words";

export { gameweekWords, versusWords } from "../words";
/** Goals for less against, signed: "+4", "-3", "0", as the league table signs its difference. */
export { differenceWords as goalDifferenceWords } from "../table/words";

export const PREMIER_LEAGUE_TITLE = "Premier League";
export const FIXTURES_TITLE = "Fixtures and results";
export const loadingWords = "Loading the Premier League's fixtures…";
export const loadingGameweekWords = (gameweek: number) => `Loading ${gameweekWords(gameweek)}'s matches…`;
export const noMatchesWords = (gameweek: number) => `No matches are held for ${gameweekWords(gameweek)} yet.`;
export const matchesListLabel = (gameweek: number) => `${gameweekWords(gameweek)}'s matches`;

const dayFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long" });
const timeFormat = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" });
/** A day's heading over its matches, in the viewer's own zone: "Saturday 17 October". */
export const dayWords = (at: number) => dayFormat.format(at);
/** A match's kickoff, in the viewer's own zone: "15:00". */
export const kickoffWords = (at: number) => timeFormat.format(at);
/** The heading over matches with no kickoff time: postponed, waiting for a new date. */
export const noDateWords = "Date to be confirmed";

/** A match's score, home first. */
export const scoreWords = (homeGoals: number, awayGoals: number) => `${homeGoals}–${awayGoals}`;

/** The match clock while it is played: the Premier League's label to the minute ("45+3'"), or
 *  FPL's minutes, which carry no stoppage time; "Live" while a read has given neither. */
export const clockWords = (clockLabel: string | null, minutes: number | null) => {
  const label = clockLabel?.split("'")[0];
  if (label) return `${label}'`;
  return minutes === null ? liveWords : `${minutes}'`;
};
export const liveWords = "Live";
export const halfTime = { short: "HT", long: "Half-time" } as const;
export const fullTime = { short: "FT", long: "Full time" } as const;

export const TABLE_TITLE = "Table";
export const loadingTableWords = "Loading the Premier League table…";
/** Said before the football sync has held the season's clubs. */
export const noClubsWords = "No clubs are held yet, so there is no table to show.";
/** Said while a match in the table is being played: its result counts as it stands (spec/18). */
export const provisionalWords = "Live: the table is provisional until every match being played is at full time.";

/** The table's columns: a short head, and what it stands for. */
export const tableColumns = {
  position: { short: "Pos", long: "Position" },
  club: { short: "Club", long: "Club" },
  played: { short: "P", long: "Played" },
  won: { short: "W", long: "Won" },
  drawn: { short: "D", long: "Drawn" },
  lost: { short: "L", long: "Lost" },
  goalsFor: { short: "GF", long: "Goals for" },
  goalsAgainst: { short: "GA", long: "Goals against" },
  goalDifference: { short: "GD", long: "Goal difference" },
  points: { short: "Pts", long: "Points" },
} as const;
