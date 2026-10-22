// What League settings says, in one place for Craig to change in the pull request. Why the server
// refused a change is in convex/rules/ (`rulesRefusals`, and leagueRulesCheck.ts's reasons), and
// reaches the screen as is.

import type { OddTeamOut } from "../../convex/table/roundRobin";
import { failedWords, gameweekWords } from "../words";

export { gameweekWords };

export const SETTINGS_TITLE = "League settings";
export const loadingWords = "Loading the league settings…";
export const noRulesWords = "This league was made before leagues held their rules, so it has no settings to edit yet.";

export const fixturesTitle = "Fixtures";
export const oddTeamOutLabel = "With an odd number of teams, the team left over plays";
export const oddTeamOutWords: Record<OddTeamOut, string> = { leagueAverage: "The league's average", bye: "No one (a bye)" };
export const gamesLabel = "Head-to-head games each team plays a gameweek";
export const gamesHint = "A whole number, 1 or more. With fewer other teams than that, each team plays every other once a gameweek.";
/** Until #266: the table draws the whole season by the latest rules, past gameweeks too. */
export const redrawWords = "Saving either redraws the whole season's fixtures, gameweeks already played among them.";
export const blankGamesWords = "Games a gameweek has no number. Fill it in, then save.";
export const savedWords = (gameweek: number) => `Saved. The new settings apply from ${gameweekWords(gameweek)}, and the league has a letter saying so.`;

export const saveFailedWords = failedWords("the settings didn't change");
