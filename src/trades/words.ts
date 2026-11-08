// What Trades says (#383; docs/design/approved/trades), in one place for Craig to change in the
// pull request.

import { NOTE_MOST, REVIEW_MS } from "../../convex/trades/tradeLimits";
import { HOUR_MS } from "../../convex/shared/time";
import type { TradesView } from "../../convex/trades/tradeScreen";
import { changeFailedWords } from "../shared/words";
import type { Reviewer } from "./seam";

export { whenWords } from "../shared/words";
export { warningWords } from "../squads/words";
export { NOTE_MOST };

export const TRADES_TITLE = "Trades";
export const tradesLoadingWords = "Loading your trades…";
export const noTeamWords = "You don't run a team in this league.";
export const tradeFailedWords = changeFailedWords;

/** Why no trade can be offered or accepted now (convex/trades/tradeShut.ts). */
export const shutWords: Record<NonNullable<TradesView["shut"]>, string> = {
  draftLive: "Trades are shut while the draft is live.",
  tradeDeadline: "The league's trade deadline has passed.",
  unusedGameweek:
    "Trades are locked through a gameweek the league doesn't play.",
};

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

/** When an open offer closes unanswered: at the next deadline. */
export const closesAtWords = (
  closes: { gameweek: number; at: number } | null,
  when: string | null,
) =>
  closes === null || when === null
    ? "At the next deadline"
    : `At the GW${closes.gameweek} deadline, ${when}`;

export const acceptWords = "Accept";
export const counterWords = "Counter";
export const rejectWords = "Reject";
export const withdrawWords = "Withdraw";
export const rejectQuestion = (teamName: string) =>
  `Reject ${teamName}'s offer?`;
export const rejectYesWords = "Reject it";
export const rejectNoWords = "Keep it";

// The New offer tab.
export const YOUR_SQUAD_TITLE = "Your squad";
export const THEIR_SQUAD_TITLE = "Their squad";
export const YOUR_OFFER_TITLE = "Your offer";
export const YOUR_COUNTER_TITLE = "Your counter";
export const squadCountWords = (count: number, maximum: number | null) =>
  maximum === null ? `${count}` : `${count} of ${maximum}`;
export const partnerLabel = "Team to trade with";
export const toTeamWords = (teamName: string) => `To ${teamName}`;
export const squadTableLabel = (teamName: string) => `${teamName}'s squad`;
export const squadColumns = {
  tick: { short: "Tick", long: "In the offer" },
  position: { short: "Pos", long: "Position" },
  player: { short: "Player", long: "Player" },
} as const;
export const tickLabel = (playerName: string) => `Trade ${playerName}`;
export const heldWords = "In review";
export const noteLabel = "Note";
export const sendOfferWords = "Send offer";
export const sendCounterWords = "Send counter";
export const clearWords = "Clear";
export const noPartnerWords = "No other team can trade now.";
export const noneTickedWords = "Tick a player on either side.";
