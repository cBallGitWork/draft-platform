// What every screen says alike about a match: its sides, score, clock and commentary, a result and
// form, and a player's points for it.

import type { PlayingState } from "../../../convex/football/matchScores";
import { figureWords } from "../../../convex/shared/numberWords";
import type { Result } from "../../../convex/table/standings";
import { listSeparator, notHeldLabel, notYetWords } from "../words";

/** Between the two sides of a match or a fixture: "Hull City v Everton". */
export const versusWords = "v";
/** Where his club plays a match, after the opponent's code (My team's tables and the player card). */
export const homeWords = "(H)";
export const awayWords = "(A)";
/** A match as its cell shows it: "CHE (H)". */
export const nextFixtureShort = (opponentCode: string, home: boolean) => `${opponentCode} ${home ? homeWords : awayWords}`;
/** A status chip after a name, until it is settled which FPL statuses each chip reads (to-grill:
 *  Status chips' data). Only a player FPL holds a doubt about gets one. */
export const statusNotSettledLabel = notHeldLabel("Status");
/** A match cell waits for fixture difficulty (to-grill: Where fixture difficulty comes from). */
export const difficultyNotRatedWords = `difficulty ${notYetWords}`;
/** A match's or a fixture's score, the first side's then the other's: "2–1", or a matchup's
 *  points, which can fall below 0: "−2–5". */
export const scoreWords = (first: number, second: number) => `${figureWords(first)}–${figureWords(second)}`;
/** A match's score as the Premier League pages and Home show it, "2–1", once it has kicked off and
 *  both goals are read; null before kickoff or while a goal is unread, where they show "v". */
export const goalsWords = (score: { state: string; homeGoals: number | null; awayGoals: number | null } | null) =>
  score !== null && score.state !== "upcoming" && score.homeGoals !== null && score.awayGoals !== null
    ? scoreWords(score.homeGoals, score.awayGoals)
    : null;
/** Beside what is still being played: a live match's clock before it has a minute, a score that
 *  may still move (spec/07). */
export const liveWords = "Live";
/** Under points, or a table, that a live match may still move: the state, not how it works. */
export const provisionalWords = "Not final";
/** A match at half-time and at full time, short as a column says it and in full. */
export const halfTime = { short: "HT", long: "Half-time" } as const;
export const fullTime = { short: "FT", long: "Full time" } as const;
/** A match's one clock while it is played, on the matchup and the Premier League's pages alike:
 *  "HT" at half-time; otherwise the Premier League's label, with stoppage time ("45+1'"), or the
 *  newest read's whole minutes where it has none (FPL's: "46'"); "Live" before either (spec/10,
 *  The matchup, as a live match; #563, #781). */
export const clockWords = (state: PlayingState, clockLabel: string | null, minutes: number | null) => {
  if (state === "halfTime") return halfTime.short;
  const label = clockLabel?.split("'")[0];
  if (label) return `${label}'`;
  return minutes === null ? liveWords : `${minutes}'`;
};

/** A result as form shows it, and as a screen reader says it: league home's table and My team's
 *  header alike. */
export const resultWords: Record<Result, { short: string; long: string }> = {
  won: { short: "W", long: "won" },
  drawn: { short: "D", long: "drawn" },
  lost: { short: "L", long: "lost" },
};
export const formLabel = (results: readonly Result[]) =>
  results.length === 0 ? "No results yet" : `Form: ${results.map((result) => resultWords[result].long).join(listSeparator)}`;
/** Form whose last result is still live: "Form: won, lost, Not final". */
export const liveFormLabel = (results: readonly Result[]) => `${formLabel(results)}${listSeparator}${provisionalWords}`;
/** A live result's chip, on hover: "won, Not final". */
export const liveResultWords = (result: Result) => `${resultWords[result].long}${listSeparator}${provisionalWords}`;
/** The heads over a team's form and table place: My team's header and a club's page. */
export const formHead = "Form";
export const tableHead = "Table";

/** A matchup's score head, and a player whose points don't count (the matchup and the Premier
 *  League's match page). */
export const SCORE_LABEL = "Score";
export const notCountingLabel = "not counting";
/** The vidiprinter (the matchup, league home, the Premier League's pages): its title, and when the
 *  stream falls behind or stops; points carry on from FPL (spec/10, The commentary). */
export const VIDIPRINTER_TITLE = "Live feed";
export const commentaryDelayedWords = "Commentary delayed";
export const noCommentaryWords = "No lines yet.";
/** The matchup's and match page's scoreboards, while live points are held as last read (S10.12). */
export const livePointsDelayedWords = "Live points delayed";

/** A commissioner's override (spec/14 S14.3 to S14.6; #32, #903), of a player's points on his card
 *  and of a team's total on the matchup alike. */
export const overriddenWords = (points: number, reason: string) => `Overridden to ${figureWords(points)} in this league: ${reason}`;
export const overrideHint = "The whole league gets a letter saying what changed and why.";
export const overrideLabels = { match: "Match", points: "Points", reason: "Why" } as const;
export const overrideWords = "Override";
export const overriddenDoneWords = "Overridden. The league gets a letter saying why.";
export const overrideFailedWords = "The override couldn't be saved. Try again.";
/** Taking an override off (#903, spec/14 S14.5): "remove override button". */
export const removeOverrideWords = "Remove override";
export const removeOverrideFailedWords = "The override couldn't be removed. Try again.";
/** A player's points for a match whose record hasn't fully arrived, on hover. */
export const notArrivedWords = "His stats for this match aren't all in yet.";
