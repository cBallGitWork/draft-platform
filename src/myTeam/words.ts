// What My team's tabs say, in one place for Craig to change in the pull request.

import { menuWords } from "../frame/words";
import type { TeamTransactions } from "./seam";

export { figureWords, liveWords, noFigureWords, shortThenLongName, versusWords, whenWords } from "../shared/words";

/** Said on any tab to someone who runs no team in the league, such as a commissioner who doesn't
 *  play. */
export const noTeamWords = "You don't run a team in this league.";
export const noRulesWords = "This league was made before leagues had rules, so it has no fixtures to draw.";

/** The Fixtures tab (#365). */
export const FIXTURES_TITLE = menuWords.fixtures;
export const fixturesLoadingWords = "Loading your fixtures…";
export const fixturesTableLabel = (teamName: string) => `${teamName}'s fixtures`;
export const fixtureColumns = {
  gameweek: { short: "GW", long: "Gameweek" },
  deadline: { short: "Deadline", long: "The league's deadline" },
  opponent: { short: "Opponent", long: "Opponent" },
  result: { short: "Result", long: "Your points, then the opponent's: the matchup" },
} as const;
export const byeWords = "Bye";
export { leagueAverageWords, provisionalWords, scoreWords, unscoredWords } from "../table/words";
export const totalPointsWords = "The league plays total points, so your team has no head-to-head fixtures.";
export const noFixturesWords = "No fixtures yet: they're drawn once the league has two teams and a gameweek to play.";

/** The Transactions tab (#366). */
export const TRANSACTIONS_TITLE = menuWords.transactions;
export const transactionsLoadingWords = "Loading your transactions…";
export const transactionsTableLabel = (teamName: string) => `${teamName}'s transactions`;
export const transactionColumns = {
  when: { short: "When", long: "When it happened" },
  player: { short: "Player", long: "Player" },
  move: { short: "Move", long: "What happened to him" },
  by: { short: "By", long: "Who made the move" },
} as const;
/** What a transaction did to the team, as its Move cell says it. */
export function transactionWords({ kind, otherTeamName }: Pick<TeamTransactions["transactions"][number], "kind" | "otherTeamName">): string {
  switch (kind) {
    case "assigned":
      return "Assigned to the team";
    case "movedIn":
      return `Moved in from ${otherTeamName}`;
    case "movedOut":
      return `Moved out to ${otherTeamName}`;
    case "released":
      return "Released to free agency";
  }
}
export const noTransactionsWords = "No transactions yet.";
/** Said when the league holds more squad moves than the tab reads (convex/squads/teamTransactions.ts). */
export const transactionsCutWords = "Only the most recent transactions are shown.";
