// What the player card says, in one place for Craig to change in the pull request.

import type { CategoryWhy, Cut, PricedBy, SlotValue } from "../../convex/scoring/scoring";
import { AREA_WORDS, figureWords, gameweekWords, signedWords, versusWords } from "../shared/words";

export { figureWords, freeAgentWords, noFigureWords } from "../shared/words";

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
/** The lines under a match: each category he earned or lost points in, as "Goals scored 5", and
 *  why. */
export const breakdownLabel = (gameweek: number | null) => (gameweek === null ? "Points by category" : `${gameweekWords(gameweek)} points by category`);
export const nothingEarnedWords = "No category earned him points.";
/** Why a category's points are what they are (spec/14, On screen), in brackets after them: "(1 at
 *  5 each for Midfield)", "(4, 1 for every 3)", "(14, 2 for 10+ and 2 for 12+, held to at most 2)",
 *  "(1 at 4 each for Defence, but none under 60 minutes)". */
export const whyWords = ({ actions, value, pricedBy, cut }: CategoryWhy) => `(${valueWords(value, actions)}${pricedByWords(pricedBy)}${cutWords(cut)})`;
const valueWords = (value: SlotValue, actions: number) => {
  switch (value.shape) {
    case "perAction":
      return `${figureWords(actions)} at ${figureWords(value.points)} each`;
    case "perCount":
      return `${figureWords(actions)}, ${figureWords(value.points)} for every ${figureWords(value.every)}`;
    case "bands":
      return `${figureWords(actions)}, ${value.earned.length === 0 ? "no band reached" : value.earned.map(({ atLeast, points }) => `${figureWords(points)} for ${figureWords(atLeast)}+`).join(" and ")}`;
  }
};
const pricedByWords = (pricedBy: PricedBy) => {
  switch (pricedBy.by) {
    case "all":
      return "";
    case "area":
      return ` for ${AREA_WORDS[pricedBy.area]}`;
    case "position":
      return ` for ${pricedBy.position}`;
  }
};
const cutWords = (cut: Cut | null) => {
  if (cut === null) return "";
  switch (cut.by) {
    case "minutes":
      return `, but none under ${figureWords(cut.atLeast)} minutes`;
    case "max":
      return `, held to at most ${figureWords(cut.limit)}`;
    case "min":
      return `, held to at least ${figureWords(cut.limit)}`;
  }
};
/** The breakdown's last line: the version of the site's scoring the match was scored under. */
export const scoredUnderWords = (version: string | null) => `Scored under ${version === null ? "the first scoring set" : `version ${version}`}`;

/** Last season's one line (spec/12): not held yet. */
export const LAST_SEASON_TITLE = "Last season";
export const lastSeasonNotHeldWords = "Only this season is held.";

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
