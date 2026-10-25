// What the player card says, in one place for Craig to change in the pull request.

import type { ScoredAs } from "../../convex/playerCard/cardPoints";
import { gameweekWords } from "../words";

export { freeAgentWords, listSeparator, noFigureWords } from "../words";

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
/** Over the matches: how they were priced. */
export const pricedNotes: Record<ScoredAs, string> = {
  slot: "Points from his slot in the lineup, under the site's scoring.",
  bestPosition: "Points at his best position, under the site's scoring: what he'd score where he scores most.",
};
export const columns = {
  gameweek: { short: "GW", long: "Gameweek" },
  match: { short: "Match", long: "Match" },
  minutes: { short: "Min", long: "Minutes played" },
  position: { short: "At", long: "The position he is priced at" },
  points: { short: "Pts", long: "Points under the site's scoring" },
} as const;
export const notArrivedWords = "His record for this match hasn't fully arrived yet.";
/** The line under a match: each category that paid, as "Goals scored 5". */
export const breakdownLabel = (gameweek: number | null) => (gameweek === null ? "Points by category" : `${gameweekWords(gameweek)} points by category`);
export const nothingPaidWords = "No category paid.";

/** Last season's one line (spec/12): not held yet. */
export const LAST_SEASON_TITLE = "Last season";
export const lastSeasonNotHeldWords = "Not held yet: the app keeps match stats from this season only, so it can't total last season under the site's scoring.";

/** His club's next fixtures. */
export const NEXT_FIXTURES_TITLE = "Next fixtures";
export const noFixturesWords = "No fixtures ahead with a date.";
