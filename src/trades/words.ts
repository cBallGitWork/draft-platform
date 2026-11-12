// What Trades says (#383; docs/design/approved/trades), in one place for Craig to change in the
// pull request.

import { pickWords } from "../../convex/mail/tradeLetterWords";
import { NOTE_MOST, REVIEW_MS } from "../../convex/trades/tradeLimits";
import { HOUR_MS } from "../../convex/shared/time";
import { changeFailedWords } from "../shared/words";
import type { ClosedOffer, Reviewer } from "./seam";

export { dateWords, noTeamWords, whenWords } from "../shared/words";
export { warningWords } from "../shared/words";
export { NOTE_MOST, pickWords };
export { viaWords } from "../shared/words";

export const TRADES_TITLE = "Trades";
export const tradesLoadingWords = "Loading your trades…";
export const tradeFailedWords = changeFailedWords;

/** Why no trade can be offered or accepted now, the same sentence the refusal gives
 *  (convex/trades/tradeShutWords.ts). */
export { shutWords } from "../../convex/trades/tradeShutWords";

// The Offers tab.
export const OFFERS_TITLE = "Offers";
export const openCountWords = (count: number) => `${count} open`;
export const offersTableLabel = "Your trade offers";
export const offersColumns = {
  with: { short: "With", long: "The team the offer is with" },
  get: { short: "You get", long: "What you get" },
  give: { short: "You give", long: "What you give" },
  waiting: { short: "Waiting on", long: "Who the offer is waiting on" },
  closes: { short: "Closes", long: "When it closes, or its review ends" },
} as const;
/** The Offers table's groups; "In review" also marks a squad's player or pick held in a trade
 *  under review, on the New offer tab. */
export const groupWords = {
  toYou: "To you",
  fromYou: "From you",
  inReview: "In review",
} as const;
export const noOffersWords = "No offers open.";

/** Who an offer waits on: you, the other team, or whoever reviews it. */
export const youWords = "You";
export const reviewerWords: Record<Reviewer, string> = {
  commissioner: "The commissioner",
  coCommissioner: "The co-commissioner",
  vote: "A league vote",
};

// The Closed offers panel: those that ended this season without going through, newest first.
export const CLOSED_TITLE = "Closed offers";
export const thisSeasonWords = "This season";
export const closedTableLabel = "Your closed trade offers";
export const closedColumns = {
  with: { short: "With", long: "The team the offer was with" },
  get: { short: "You get", long: "What you would have got" },
  give: { short: "You give", long: "What you would have given" },
  closed: { short: "Closed", long: "Why it closed" },
  when: { short: "When", long: "When it closed" },
} as const;
export const noClosedWords = "No closed offers this season.";
export const olderWords = "Older ›";

/** Why an offer closed, from the manager's side: `you` when his team is the one that acted. */
export function closedWhyWords(why: ClosedOffer["why"], you: boolean): string {
  const who = you ? "You" : "They";
  switch (why) {
    case "withdrawn":
      return `${who} withdrew it`;
    case "rejected":
      return `${who} rejected it`;
    case "countered":
      return `${who} countered it`;
    case "deadline":
      return "Unanswered by the deadline";
    case "tradeDeadline":
      return "Trade deadline passed";
    case "unusedGameweek":
      return "Trades locked through an unplayed gameweek";
    case "draftStarted":
      return "The draft started";
    case "pickTraded":
      return "Its pick was traded";
    case "autoTeam":
      return "A team went on the auto team";
    case "playerLeft":
      return "A player left his squad";
    case "blocked":
      return "Blocked in review";
    case "failed":
      return "Couldn't go through";
  }
}

// The selected offer's panel.
export const offerToYouTitle = (teamName: string) => `${teamName}'s offer`;
export const yourOfferToTitle = (teamName: string) =>
  `Your offer to ${teamName}`;
export const tradeWithTitle = (teamName: string) =>
  `Your trade with ${teamName}`;
export const youGetWords = "You get";
export const youGiveWords = "You give";
export const nobodyWords = "Nobody";
export const noteWords = (note: string) => `“${note}”`;
export const yourSquadWords = "Your squad";
export const theirSquadWords = "Their squad";
export const waitingOnWords = "Waiting on";
export const reviewWords = "Review";
export const closesWords = "Closes";
export const reviewEndsWords = "Review ends";
export const squadAfterWords = (count: number, maximum: number | null) =>
  maximum === null ? `${count} after it` : `${count} of ${maximum} after it`;
export const afterItWords = (warning: string) => `After it: ${warning}`;

const reviewHours = REVIEW_MS / HOUR_MS;
/** How an accepted offer is reviewed: `byYou` when the manager is the one to accept it. */
export function reviewRuleWords(
  reviewer: Reviewer | null,
  byYou: boolean,
): string {
  const once = byYou ? "once you accept" : "once they accept";
  if (reviewer === null) return `None: it goes through ${once}`;
  const who = {
    commissioner: "Commissioner veto",
    coCommissioner: "Co-commissioner veto",
    vote: "League vote",
  }[reviewer];
  return `${who}: ${reviewHours} hours ${once}`;
}

/** When an offer made in the trade deadline's gameweek closes: its last match has no time known
 *  ahead, so it shows in words (Craig, 11 Nov 2026, on #1492). */
export const afterLastMatchWords = (gameweek: number) =>
  `After GW${gameweek}'s last match`;

/** When an open offer closes unanswered at a known deadline, in its panel; its row shows the time
 *  alone. */
export const closesAtWords = (gameweek: number, when: string) =>
  `At the GW${gameweek} deadline, ${when}`;

export const acceptWords = "Accept";
export const counterWords = "Counter";
export const rejectWords = "Reject";
export const withdrawWords = "Withdraw";
export const rejectQuestion = (teamName: string) =>
  `Reject ${teamName}'s offer?`;
export const rejectYesWords = "Reject it";
export const rejectNoWords = "Keep it";

// A trade the manager reviews (Craig, 10 Nov 2026): its To review group at the top of Offers, and
// its panel with Block, Against or Take back. Only his own vote shows, never the count.
export const toReviewWords = "To review";
export const betweenWords = (fromTeamName: string, toTeamName: string) =>
  `${fromTeamName} and ${toTeamName}`;
export const teamGetsWords = (teamName: string) => `${teamName} get`;
export const tradeBetweenTitle = (fromTeamName: string, toTeamName: string) =>
  `The trade between ${fromTeamName} and ${toTeamName}`;
/** How the trade is reviewed, from the reviewer's side. */
export const yourReviewWords = {
  block: "Your veto",
  against: "League vote",
  takeBack: "League vote",
} as const;
export const blockWords = "Block";
export const blockQuestion = (fromTeamName: string, toTeamName: string) =>
  `Block the trade between ${fromTeamName} and ${toTeamName}?`;
export const blockYesWords = "Block it";
export const blockNoWords = "Let it stand";
export const againstWords = "Against";
export const votedAgainstWords = "You voted against";
export const takeBackWords = "Take back";

// The New offer tab.
export const YOUR_OFFER_TITLE = "Your offer";
export const YOUR_COUNTER_TITLE = "Your counter";
export const squadCountWords = (count: number, maximum: number | null) =>
  maximum === null ? `${count}` : `${count} of ${maximum}`;
export const partnerLabel = "Team to trade with";
export const toTeamWords = (teamName: string) => `To ${teamName}`;
export { squadTableLabel } from "../shared/words";
export const squadColumns = {
  tick: { short: "Tick", long: "In the offer" },
  position: { short: "Pos", long: "Position" },
  player: { short: "Player", long: "Player" },
} as const;
export const tickLabel = (playerName: string) => `Trade ${playerName}`;
/** The Picks block under each squad on the New offer tab (#1096; the approved trades README,
 *  Picks): the draft picks a team holds before the draft, one for one and nothing else (spec/04). */
export const PICKS_TITLE = "Picks";
export const picksTableLabel = (teamName: string) => `${teamName}'s picks`;
export const pickRoundWords = (round: number) => `Round ${round}`;
export const pickTickLabel = (round: number, teamName: string) =>
  `Trade ${pickWords(round, teamName)}`;
/** One pick ticked, and none on the other side yet: a pick trade is one pick each way. */
export const onePickEachWords = "Tick a pick on the other side too.";
/** The picture says "Note, one line"; the Glossary avoids "line" (it means an area of the pitch),
 *  so the label takes spec/08's own "one-line note". */
export const noteLabel = "One-line note";
export const sendOfferWords = "Send offer";
export const sendCounterWords = "Send counter";
export const clearWords = "Clear";
export const noPartnerWords = "No other team can trade now.";
