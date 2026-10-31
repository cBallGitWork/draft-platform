// What the player card says, in one place for Craig to change in the pull request.

import { figureWords, gameweekWords, signedWords, versusWords } from "../shared/words";

export { figureWords, freeAgentWords, listSeparator, noFigureWords } from "../shared/words";

export const backWords = "Back";
export const loadingWords = "Loading the player…";
export const noSuchPlayerWords = "No player with that code is held: the link may be wrong.";
export const goneWords = "No longer in the Premier League.";

/** The facts at the head of the card. */
export const PLAYER_TITLE = "Player";
export const clubLabel = "Club";
export const positionsLabel = "Positions";
export const noPositionsWords = "None yet";
export const ownerLabel = "Team";
export const newsLabel = "News";
export const noNewsWords = "None";
export const chanceWords = (percent: number) => `${percent}% chance of playing next round`;

/** This season's matches. */
export const SEASON_TITLE = "This season";
export const noMatchesWords = "He hasn't played a match this season.";
/** The switch over the matches: which of his positions they are priced at. */
export const pricedAtLabel = "Points at";
/** Beside points that may still move ("Live", as on My team's fixtures): the match isn't final, or
 *  his team's auto-subs aren't (spec/12). */
export { liveWords } from "../shared/words";
export { provisionalWords } from "../shared/words";
export const columns = {
  gameweek: { short: "GW", long: "Gameweek" },
  match: { short: "Match", long: "Match" },
  minutes: { short: "Min", long: "Minutes played" },
  position: { short: "At", long: "The position he is priced at" },
  points: { short: "Pts", long: "Points under the site's scoring" },
} as const;
export const notArrivedWords = "His record for this match hasn't fully arrived yet.";
/** The line under a match: each category he earned or lost points in, as "Goals scored 5". */
export const breakdownLabel = (gameweek: number | null) => (gameweek === null ? "Points by category" : `${gameweekWords(gameweek)} points by category`);
export const nothingEarnedWords = "No category earned him points.";

/** Last season's one line (spec/12): not held yet. */
export const LAST_SEASON_TITLE = "Last season";
export const lastSeasonNotHeldWords = "Not held yet.";

/** His club's next fixtures. */
export const NEXT_FIXTURES_TITLE = "Next fixtures";
export const noFixturesWords = "No fixtures ahead with a date.";

/** A commissioner's override of his points in a match (#32, spec/14). */
export const overriddenWords = (points: number, reason: string) => `Overridden to ${figureWords(points)} in this league: ${reason}`;
export const OVERRIDE_TITLE = "Override points";
export const overrideHint = "The whole league gets a letter saying what changed and why.";
export const overrideLabels = { match: "Match", points: "Points", reason: "Why" } as const;
export const overrideMatchWords = (gameweek: number | null, home: string, away: string) =>
  `${gameweek === null ? "" : `${gameweekWords(gameweek)}: `}${home} ${versusWords} ${away}`;
export const overrideWords = "Override";
export const cancelOverrideWords = "Cancel";
export const overriddenDoneWords = "Overridden: the league has a letter saying why.";
export const overrideFailedWords = "The override couldn't be saved. Try again.";

/** A role's adjustment, signed: "+2", "−1", "0". */
export const adjustmentWords = signedWords;
/** What made his role's adjustment, under it: "Accurate cross 2, Clean sheets 1". */
export const roleMadeOfWords = (lines: readonly { name: string; actions: number }[]) => lines.map(({ name, actions }) => `${name} ${actions}`).join(", ");
/** The role line's name for screen readers: "Role adjustment, Attacking full-back". */
export const roleLineLabel = (name: string) => `Role adjustment, ${name}`;
