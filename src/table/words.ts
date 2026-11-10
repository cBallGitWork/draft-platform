// What the table and fixtures screen says, in one place for Craig to change in the pull request.

import { andListWords } from "../../convex/shared/moments";
import { FORM_RESULTS } from "../../convex/table/standings";
import { menuWords } from "../frame/words";
import { failedWords, fewestTeamsWords, gameweekWords, signedWords } from "../shared/words";

export { figureWords, gameweekWords, liveWords, scoreWords, versusWords } from "../shared/words";

export const TABLE_PAGE_TITLE = "Table and fixtures";
export const TABLE_TITLE = menuWords.table;
export const FIXTURES_TITLE = "Fixtures";
export const loadingWords = "Loading the table and fixtures…";

/** Said while every team has played nothing: no gameweek scored since the league was made. */
export const noResultsWords = "No results yet.";

/** Beside points a live match still moves (spec/07). */
export { provisionalWords } from "../shared/words";

/** A gameweek begun that couldn't be scored, and why (#287): it counts for nothing until it can. */
export const unscoredWords = (gameweek: number, reason: string) =>
  `${gameweekWords(gameweek)} can't be scored, so it counts for nothing in the table: ${reason}.`;

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
  form: { short: "Form", long: `Form, the latest ${FORM_RESULTS} results, oldest first` },
} as const;
/** Before the reader's own team's name, for screen readers: the cyan edge says it on screen. */
export const yourTeamWords = "Your team";

/** The page's title plate: the head-to-head page's tabs, and a total-points league's title, which
 *  has no fixtures (the approved total-points picture). */
export const COMPETITIONS = ["league", "cup"] as const;
export type Competition = (typeof COMPETITIONS)[number];
export const competitionWords: Record<Competition, string> = { league: "League", cup: "Cup" };
export const competitionsLabel = "Competition";
export const TOTAL_POINTS_PAGE_TITLE = TABLE_TITLE;

/** On the table's plate: the last gameweek it counts, while none is live. */
export const afterWords = (gameweek: number) => `After GW${gameweek}`;

/** The Cup tab until cups are grilled and built (SPEC.md, Later): an empty eight-team bracket. */
export const CUP_TITLE = "Cup";
export const cupTeamsWords = "Eight teams";
export const cupRounds = ["Quarter-finals", "Semi-finals", "Final"] as const;
/** On a placeholder tie's hover: what will show there. */
export const cupTieLabel = (round: string, tie: number) => `${round}, tie ${tie}: drawn once the league has a cup`;

export const leagueAverageWords = "League average";
/** The teams with a bye in a gameweek: one a game, so several when a league plays more than one. */
export const byeWords = (teamNames: readonly string[]) => `${andListWords(teamNames)} ${teamNames.length === 1 ? "has" : "have"} a bye.`;
export const fixturesListLabel = (gameweek: number) => `${gameweekWords(gameweek)}'s fixtures`;

export const tooFewTeamsWords = `Fixtures are drawn once the league has ${fewestTeamsWords}.`;
export const noGameweeksWords = "The league plays no gameweeks, so it has no fixtures.";

/** A commissioner's fixture swap (spec/09, Fixture edits; the approved auto-team picture): the
 *  plate's state once a side is picked, the hint, the buttons, and each side's button for screen
 *  readers. */
export const editingWords = "Editing";
export const pickAnotherWords = "Pick a team in another game. Only this gameweek changes.";
export const saveSwapWords = "Save swap";
export { cancelWords } from "../shared/words";
export const pickSideLabel = (side: string) => `Swap ${side}`;
/** When a swap failed before the server could say why. */
export const swapFailedWords = failedWords("the fixtures didn't change");

/** Points for less against, signed: "+4.5", "−3", "0". */
export const differenceWords = signedWords;
