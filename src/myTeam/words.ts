// What My team's tabs say, in one place for Craig to change in the pull request.

import { countInWords } from "../../convex/shared/numberWords";
import { NEXT_MATCHES_SHOWN } from "../../convex/squads/squadLimits";
import { fewestTeamsWords, gameweekColumn, gameweekShort, menuWords, versusWords, withTeamWords } from "../shared/words";
import type { TeamTransactions } from "./seam";

export { dateWords, figureOrNone, figureWords, liveWords, noFigureWords, noTeamWords, placeWords, shortThenLongName, tradedPickWords, versusWords, whenWords, withTeamWords } from "../shared/words";

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
export const resultsTableLabel = (teamName: string) => `${teamName}'s results`;
export const fixtureColumns = {
  gameweek: gameweekColumn,
  date: { short: "Date", long: "The day of the league's deadline" },
  opponent: { short: "Opponent", long: "Opponent" },
  now: { short: "Now", long: "The opponent's place in the table now" },
  next: { short: "", long: "The next game" },
  result: { short: "Result", long: "Your points, then the opponent's: the matchup" },
} as const;
/** The panels' titles and what their plates say beside them (the approved picture). */
export const RESULTS_TITLE = "Results";
export const toPlayWords = (count: number) => `${count} to play`;
export const nextGameWords = "Next";
export const nextGameTitle = (gameweek: number, opponent: string) => `${gameweekShort(gameweek)} ${versusWords} ${opponent}`;
export const deadlineWords = "Deadline";
export const theirFormWords = "Their form";
export const matchupMoreWords = "Matchup";
export const SEASON_TITLE = "Season";
export const tableMoreWords = "Table";
export const byeWords = "Bye";
export { leagueAverageWords, provisionalWords, scoreWords, unscoredWords } from "../shared/words";
export const totalPointsWords = "The league plays total points, so your team has no head-to-head fixtures.";
export const noFixturesWords = `No fixtures yet: they're drawn once the league has ${fewestTeamsWords} and a gameweek to play.`;

/** The Transactions tab (#366). */
export const TRANSACTIONS_TITLE = menuWords.transactions;
export const transactionsLoadingWords = "Loading your transactions…";
export const transactionsTableLabel = (teamName: string) => `${teamName}'s transactions`;
/** History's columns (the team-transactions picture): what came in and what went out, and who. */
export const transactionColumns = {
  when: { short: "Date", long: "When it happened" },
  kind: { short: "Kind", long: "What kind of transaction" },
  in: { short: "In", long: "Who or what joined the team" },
  out: { short: "Out", long: "Who or what left the team" },
  by: { short: "By", long: "Who made it, or the team on the other side of a trade" },
} as const;
type Transaction = TeamTransactions["transactions"][number];
/** The kinds History's Show keys pick between (#1031): a commissioner's assignments, moves and
 *  releases are all Assigned. */
export const historyShows = ["all", "claims", "freeAgents", "drops", "trades", "assigned"] as const;
export type HistoryShow = (typeof historyShows)[number];
export const historyShowWords: Record<HistoryShow, string> = { all: "All", claims: "Claims", freeAgents: "Free agents", drops: "Drops", trades: "Trades", assigned: "Assigned" };
export const historyShowLabel = "Show";
/** The Show key each kind is under. */
export const showOf: Record<Transaction["kind"], Exclude<HistoryShow, "all">> = {
  claimed: "claims",
  pickedUp: "freeAgents",
  dropped: "drops",
  traded: "trades",
  assigned: "assigned",
  movedIn: "assigned",
  movedOut: "assigned",
  released: "assigned",
};
/** A transaction's Kind cell. */
export const transactionKindWords: Record<Exclude<HistoryShow, "all">, string> = { claims: "Claim", freeAgents: "Free agent", drops: "Drop", trades: "Trade", assigned: "Assigned" };
/** Who made a transaction, as By says it: "You", or whoever did, with where a commissioner's move
 *  took him ("commish@example.com, to Hull Hearts"). A trade's By names the other team. */
export function transactionByWords(transaction: Transaction): string {
  if (transaction.kind === "traded") return withTeamWords(transaction.otherTeamName);
  const by = transaction.yours ? "You" : transaction.by;
  switch (transaction.kind) {
    case "movedIn":
      return `${by}, from ${transaction.otherTeamName}`;
    case "movedOut":
      return `${by}, to ${transaction.otherTeamName}`;
    case "released":
      return `${by}, to free agency`;
    default:
      return by;
  }
}
export const noTransactionsWords = "No transactions yet.";
/** History under a Show key holding none of the team's. */
export const noneShownWords = "None of this kind.";
/** Said when the league holds more squad moves than the tab reads (convex/squads/teamTransactions.ts). */
export const transactionsCutWords = "Only the most recent transactions are shown.";
