// What My team's tabs say, in one place for Craig to change in the pull request.

import { countInWords } from "../../convex/shared/numberWords";
import { NEXT_MATCHES_SHOWN } from "../../convex/squads/squadLimits";
import { menuWords } from "../frame/words";
import { fewestTeamsWords } from "../shared/words";
import type { TeamTransactions } from "./seam";

export { figureWords, liveWords, noFigureWords, noTeamWords, shortThenLongName, versusWords, whenWords } from "../shared/words";

// What the Squad and Tactics tabs' tables and panels both say (#1042).

export { awayWords, difficultyNotRatedWords, homeWords, nextFixtureShort, statusNotSettledLabel } from "../shared/words";
/** A match's hover: "Chelsea, at home, Sat 5 Sep, 15:00". */
export const nextFixtureLong = (opponent: string, home: boolean, kickoff: string) => `${opponent}, ${home ? "at home" : "away"}, ${kickoff}`;
export const noNextFixtureWords = "No match with a kickoff time yet.";
/** A match whose kickoff time FPL hasn't set yet, in its hover. */
export const noKickoffWords = "kickoff time not set";
/** A points cell with no figure: none of his matches is priced yet. */
export const noPointsWords = "No points yet: none of his matches has been priced.";
/** A bench place's short name, first sub S1. */
export const benchShort = (place: number) => `S${place}`;
/** A squad row's next matches, as a head says it: "Next 3", and in full. */
export const nextMatchesShort = `Next ${NEXT_MATCHES_SHOWN}`;
export const nextMatchesLong = `His club's next ${countInWords(NEXT_MATCHES_SHOWN)} matches`;

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
export const noFixturesWords = `No fixtures yet: they're drawn once the league has ${fewestTeamsWords} and a gameweek to play.`;

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
    case "dropped":
      return "Dropped";
    case "claimed":
      return "Claimed off waivers";
    case "pickedUp":
      return "Picked up as a free agent";
  }
}
export const noTransactionsWords = "No transactions yet.";
/** Said when the league holds more squad moves than the tab reads (convex/squads/teamTransactions.ts). */
export const transactionsCutWords = "Only the most recent transactions are shown.";
