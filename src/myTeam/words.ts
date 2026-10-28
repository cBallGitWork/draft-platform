// What My team's tabs say, in one place for Craig to change in the pull request.

import { menuWords } from "../frame/words";
import { failedWords } from "../words";
import type { TeamTransactions } from "./seam";

export { noFigureWords, versusWords, whenWords } from "../words";

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
  result: { short: "Result", long: "Your points, then the opponent's: the matchup" },
} as const;
export const byeWords = "Bye";
/** Beside a score that may still move: a match it counts is live, or not yet final (spec/07). */
export const liveWords = "Live";
export { leagueAverageWords, provisionalWords, scoreWords, unscoredWords } from "../table/words";
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

/** The Squad tab (#364). */
export const SQUAD_TITLE = menuWords.squad;
export const squadLoadingWords = "Loading your squad…";
export const squadTableLabel = (teamName: string) => `${teamName}'s squad`;
export const squadColumns = {
  number: { short: "No.", long: "Squad number" },
  positions: { short: "Pos", long: "Positions" },
  player: { short: "Player", long: "Player" },
  club: { short: "Club", long: "Club" },
  next: { short: "Next", long: "His club's next match" },
  last: { short: "Last", long: "Points last gameweek" },
  season: { short: "Season", long: "Points this season" },
} as const;
/** The Last column's hover, naming the gameweek. */
export const lastGameweekLong = (gameweek: number) => `Points in gameweek ${gameweek}`;
/** Where his club plays its next match, after the opponent's code. */
export const homeWords = "(H)";
export const awayWords = "(A)";
/** The next match's hover: "Chelsea, at home, Sat 5 Sep, 15:00". */
export const nextFixtureLong = (opponent: string, home: boolean, kickoff: string) => `${opponent}, ${home ? "at home" : "away"}, ${kickoff}`;
export const noNextFixtureWords = "No match with a kickoff time yet.";
/** A points cell with no figure: none of his matches is priced yet. */
export const noPointsWords = "No points yet: none of his matches has been priced.";
export { goneWords } from "../squads/words";
export const noSquadWords = "Your squad is empty: players the commissioner assigns show here.";

/** The squad number box's name, for one player (#13). */
export const numberLabel = (name: string) => `${name}'s squad number`;
export const numberFailedWords = failedWords("the squad number wasn't changed");
