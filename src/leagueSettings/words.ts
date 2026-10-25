// What League settings says, in one place for Craig to change in the pull request. Why the server
// refused a change is in convex/rules/ (`rulesRefusals`, and leagueRulesCheck.ts's reasons), and
// reaches the screen as is.

import { MOST_IN_SQUAD } from "../../convex/leagues/leagueLimits";
import { STARTER_COUNT } from "../../convex/lineup/lineup";
import type { Area } from "../../convex/lineup/pitch";
import type { OddTeamOut } from "../../convex/table/roundRobin";
import { AREA_WORDS, failedWords, gameweekWords } from "../words";

export const SETTINGS_TITLE = "League settings";
export const loadingWords = "Loading the league settings…";
export const noRulesWords = "This league was made before leagues held their rules, so it has no settings to edit yet.";

export const fixturesTitle = "Fixtures";
export const oddTeamOutLabel = "With an odd number of teams, the team left over plays";
export const oddTeamOutWords: Record<OddTeamOut, string> = { leagueAverage: "The league's average", bye: "No one (a bye)" };
export const gamesLabel = "Head-to-head games each team plays a gameweek";
export const gamesHint = "A whole number, 1 or more. With fewer other teams than that, each team plays every other once a gameweek.";
/** Craig, 22 Oct 2026 (#266): "games played in past are done". */
export const redrawWords = "Saving either redraws the fixtures from the gameweek it applies from. Gameweeks already played keep theirs.";
export const blankGamesWords = "Games a gameweek has no number. Fill it in, then save.";

export const squadTitle = "Squad";
export const squadMaximumLabel = "Most players in a squad";
export const squadMaximumHint = `A whole number, ${STARTER_COUNT} to ${MOST_IN_SQUAD}, a Premier League squad, and no fewer than the league's least squad size.`;
export const noSquadSizeWords = "This league's squads have no size limit.";
export const blankSquadMaximumWords = `${squadMaximumLabel} has no number. Fill it in, then save.`;
export const areaMinimumsLabel = "Fewest players in each area";
/** One area's box, for screen readers: "Fewest in Defence". */
export const areaMinimumLabel = (area: Area) => `Fewest in ${AREA_WORDS[area]}`;
export const areaMinimumsHint = "Whole numbers, 0 for none, adding up to no more than the squad's most. A player who plays two areas counts in one, whichever helps.";
export const blankAreaMinimumWords = (area: Area) => `${areaMinimumLabel(area)} has no number. Fill it in, or put 0, then save.`;
export const clubMaximumWords = "A limit on players from one club";
export const clubMaximumLabel = "Most players from one club";
export const clubMaximumHint = "A whole number, 1 or more.";
export const blankClubMaximumWords = `${clubMaximumLabel} has no number. Fill it in, or turn the limit off, then save.`;

export const savedWords = (gameweek: number) => `Saved. The new settings apply from ${gameweekWords(gameweek)}, and the league has a letter saying so.`;

/** What a failed save leaves, live or in the preview. */
export const unsavedOutcome = "the settings didn't change";
export const saveFailedWords = failedWords(unsavedOutcome);
