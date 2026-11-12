// What the table and fixtures screen says, in one place for Craig to change in the pull request.

import { andListWords } from "../../convex/shared/moments";
import { seasonName } from "../../convex/shared/time";
import { FORM_RESULTS } from "../../convex/table/standings";
import { failedWords, fewestTeamsWords, gameweekShort, gameweekWords, signedWords, TABLE_TITLE } from "../shared/words";

export { figureWords, gameweekWords, liveWords, scoreWords, versusWords } from "../shared/words";
/** The table's title, said while every team has played nothing, beside points a live match still
 *  moves (spec/07), a gameweek begun that couldn't be scored (#287), the reader's own team for
 *  screen readers, and the league average: src/shared/words.ts, as other screens say them too. */
export { leagueAverageWords, noResultsWords, provisionalWords, TABLE_TITLE, unscoredWords, yourTeamWords } from "../shared/words";

export const TABLE_PAGE_TITLE = "Table and fixtures";
export const FIXTURES_TITLE = "Fixtures";
export const loadingWords = "Loading the table and fixtures…";

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

/** A total-points table's columns, on the Table page and League home alike: total points has no
 *  matchups to win, draw or lose. */
export const TOTAL_POINTS_COLUMNS = ["position", "team", "played", "points"] as const satisfies readonly (keyof typeof columns)[];

/** The page's title plate: the head-to-head page's tabs, and a total-points league's title, which
 *  has no fixtures (the approved total-points picture). */
export const COMPETITIONS = ["league", "cup"] as const;
export type Competition = (typeof COMPETITIONS)[number];
export const competitionWords: Record<Competition, string> = { league: "League", cup: "Cup" };
export const competitionsLabel = "Competition";
export const TOTAL_POINTS_PAGE_TITLE = TABLE_TITLE;

/** On the table's plate: the last gameweek it counts, while none is live. */
export const afterWords = (gameweek: number) => `After ${gameweekShort(gameweek)}`;

/** At the page plate's far end (the approved pictures): the season, then the last gameweek the
 *  table counts, or the gameweek being played while one is live: "2026/27, after GW9",
 *  "2026/27, GW10", or the season alone before any result. */
export const seasonLineWords = (seasonStartYear: number, latest: { gameweek: number; live: boolean } | undefined) =>
  latest === undefined
    ? seasonName(seasonStartYear)
    : `${seasonName(seasonStartYear)}, ${latest.live ? gameweekShort(latest.gameweek) : `after ${gameweekShort(latest.gameweek)}`}`;

/** Over a gameweek's league games in Fixtures (the approved picture); a cup's games follow under
 *  their own head once cups are built. */
export const leagueGamesHead = competitionWords.league;

/** The Cup tab until cups are grilled and built (SPEC.md, Later): an empty eight-team bracket. */
export const CUP_TITLE = competitionWords.cup;
export const cupTeamsWords = "Eight teams";
export const cupRounds = ["Quarter-finals", "Semi-finals", "Final"] as const;
/** On a placeholder tie's hover: what will show there. */
export const cupTieLabel = (round: string, tie: number) => `${round}, tie ${tie}: drawn once the league has a cup`;

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
/** What a failed swap leaves, live or in the preview. */
export const swapUnsavedOutcome = "the fixtures didn't change";
export const swapFailedWords = failedWords(swapUnsavedOutcome);

/** Points for less against, signed: "+4.5", "−3", "0". */
export const differenceWords = signedWords;
