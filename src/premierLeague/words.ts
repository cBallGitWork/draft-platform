// What the Premier League section says, in one place for Craig to change in the pull request.

import { LOCALE } from "../../convex/shared/londonTime";
import { gameweekWords } from "../words";

export { gameweekWords, versusWords } from "../words";

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
