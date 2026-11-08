// What league home says, in one place for Craig to change in the pull request.

import { TOP_ROWS } from "../../convex/home/glance";
import { FORM_RESULTS } from "../../convex/table/standings";
import { fewestTeamsWords, noHeadToHeadsTotalPointsWords } from "../shared/words";
import { columns as tableColumns } from "../table/words";
import type { LeagueHome } from "./seam";

export { figureWords, gameweekWords, versusWords } from "../shared/words";
export { leagueAverageWords, noResultsWords, TABLE_TITLE } from "../table/words";

export const HOME_TITLE = "League home";
export const loadingWords = "Loading league home…";
export const noRulesWords = "This league was made before leagues had rules, so it has no table or fixtures to show.";

/** The head-to-heads' title with no gameweek to name: with one, it is the gameweek. */
export const HEAD_TO_HEADS_TITLE = "Head-to-heads";
export const headToHeadsLabel = (gameweekName: string) => `${gameweekName}'s head-to-heads`;
export const noHeadToHeadsWords = {
  totalPoints: noHeadToHeadsTotalPointsWords,
  headToHead: `Head-to-heads are drawn once the league has ${fewestTeamsWords}.`,
} as const satisfies Record<LeagueHome["format"], string>;
export const byeWords = (teamName: string) => `${teamName}: bye`;

/** Under a table cut to its top rows: how many teams it has, and whether the reader's row is added. */
export const partTableWords = (teams: number, withMine: boolean) =>
  `The top ${TOP_ROWS} of ${teams} teams${withMine ? ", and yours" : ""}.`;
/** The table screen's columns, and form. */
export const columns = {
  ...tableColumns,
  form: { short: "Form", long: `Form, the latest ${FORM_RESULTS} results, oldest first` },
} as const;
export const yourTeamWords = "Your team";
export { formLabel, resultWords } from "../shared/words";
export const noFormWords = "—";
export const wholeTableLink = "Whole table and fixtures";

/** The matchday's Vidiprinter, and its words before any line, the matchup's own. */
export { noCommentaryWords as noMatchdayLinesWords, VIDIPRINTER_TITLE } from "../matchup/words";

export const LETTER_TITLE = "From the commissioner";
export const noLetterWords = "Nothing from the commissioner yet.";
export const fromWords = (from: string) => `From ${from}`;
export const inMailLink = "Every letter, in Mail";

/** The weekly recap (spec/12, League home): its panel, Read the recap's page, and the line under it
 *  once a score has changed since it was written (Craig, 6 Nov 2026). */
export const recapTitle = (gameweek: number) => `GW${gameweek} recap`;
export const readRecapLink = "Read the recap";
export const scoreChangedWords = "A score has changed since this recap was written.";
export const changedMatchupLink = "See the matchup";
export const loadingRecapWords = "Loading the recap…";
export const noRecapWords = (gameweek: number) => `No recap of Gameweek ${gameweek} yet.`;
export const backHomeLink = "Back to League home";

export const MOVES_TITLE ="Claims, drops and trades";
export const noMovesWords = "No player has joined or left a squad yet.";
type SquadMove = LeagueHome["squadMoves"][number];
/** A squad move in a line: "Saka joined Kroos Control". */
export function moveWords({ kind, playerName, teamName, fromTeamName }: SquadMove): string {
  switch (kind) {
    case "playerAssigned":
      return `${playerName} joined ${teamName}`;
    case "playerMoved":
      return `${playerName} moved from ${fromTeamName} to ${teamName}`;
    case "playerReleased":
      return `${playerName} was released by ${teamName}`;
    case "playerDropped":
      return `${playerName} was dropped by ${teamName}`;
    case "playerClaimed":
      return `${playerName} was claimed by ${teamName}`;
    case "playerPickedUp":
      return `${playerName} was picked up by ${teamName}`;
  }
}
