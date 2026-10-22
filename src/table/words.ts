// What the table and fixtures screen says, in one place for Craig to change in the pull request.

import { LOCALE } from "../../convex/shared/londonTime";

export const TABLE_PAGE_TITLE = "Table and fixtures";
export const TABLE_TITLE = "Table";
export const FIXTURES_TITLE = "Fixtures";
export const loadingWords = "Loading the table and fixtures…";
export const noRulesWords = "This league was made before leagues had rules, so it has no fixtures or table to draw.";

/** Said while every team has played nothing: no matchup is scored yet (#29). */
export const noResultsWords = "No results yet: the app doesn't score matchups yet, so every team is on 0 until it does.";

/** The table's columns: a short head, and what it stands for. */
export const columns = {
  position: { short: "Pos", long: "Position" },
  team: { short: "Team", long: "Team" },
  played: { short: "P", long: "Played" },
  won: { short: "W", long: "Won" },
  drawn: { short: "D", long: "Drawn" },
  lost: { short: "L", long: "Lost" },
  pointsFor: { short: "F", long: "Points for" },
  pointsAgainst: { short: "A", long: "Points against" },
  difference: { short: "+/-", long: "Points for less points against" },
  points: { short: "Pts", long: "Points" },
} as const;

export const gameweekWords = (gameweek: number) => `Gameweek ${gameweek}`;
export const previousLabel = "Previous gameweek";
export const nextLabel = "Next gameweek";
export const versusWords = "v";
export const leagueAverageWords = "League average";
const andList = new Intl.ListFormat(LOCALE, { type: "conjunction" });
/** The teams with a bye in a gameweek: one a game, so several when a league plays more than one. */
export const byeWords = (teamNames: readonly string[]) => `${andList.format(teamNames)} ${teamNames.length === 1 ? "has" : "have"} a bye.`;
export const fixturesListLabel = (gameweek: number) => `${gameweekWords(gameweek)}'s fixtures`;
export const roundRobinWords = (rounds: number) =>
  `Every team meets every other once a round robin of ${rounds} rounds, and each round robin is drawn in its own order.`;

export const totalPointsWords = "The league plays total points, so it has no matchups or fixtures: the table ranks teams by their points.";
export const tooFewTeamsWords = "Fixtures are drawn once the league has two teams.";
export const noGameweeksWords = "The league plays no gameweeks, so it has no fixtures.";

/** Points for less against, signed: "+4.5", "-3", "0". */
export const differenceWords = (difference: number) => (difference > 0 ? `+${difference}` : String(difference));
