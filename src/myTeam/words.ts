// What My team's tabs say, in one place for Craig to change in the pull request.

import { menuWords } from "../frame/words";
import type { TeamTransactions } from "./seam";

export { noFigureWords, whenWords } from "../words";

/** Said on any tab to someone who runs no team in the league, such as a commissioner who doesn't
 *  play. */
export const noTeamWords = "You don't run a team in this league, so there's nothing to show here.";
export const noRulesWords = "This league was made before leagues had rules, so it has no fixtures to draw.";

/** The Fixtures tab (#365). */
export const FIXTURES_TITLE = menuWords.fixtures;
export const fixturesLoadingWords = "Loading your fixtures…";
export const fixturesTableLabel = (teamName: string) => `${teamName}'s fixtures`;
export const fixtureColumns = {
  gameweek: { short: "GW", long: "Gameweek" },
  deadline: { short: "Deadline", long: "The league's deadline" },
  opponent: { short: "Opponent", long: "Opponent" },
} as const;
export const leagueAverageWords = "League average";
export const byeWords = "Bye";
/** Under the fixtures while no matchup is scored (#29). */
export const noResultsWords = "No results yet: the app doesn't score matchups yet, so each game shows as a fixture until it does.";
export const totalPointsWords = "The league plays total points, so your team has no head-to-head fixtures.";
export const noFixturesWords = "No fixtures yet: they're drawn once the league has two teams and a gameweek to play.";

/** The Transactions tab (#366). */
export const TRANSACTIONS_TITLE = menuWords.transactions;
export const transactionsLoadingWords = "Loading your transactions…";
export const transactionsTableLabel = (teamName: string) => `${teamName}'s transactions`;
export const transactionColumns = { when: "When", player: "Player", move: "Move", by: "By" } as const;
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
export const noTransactionsWords = "No transactions yet: players the commissioner assigns, moves or releases show here.";
/** Said when the league holds more events than the tab searches (convex/squads/teamTransactions.ts). */
export const transactionsCutWords = "Only the most recent transactions are shown: older ones aren't searched.";
