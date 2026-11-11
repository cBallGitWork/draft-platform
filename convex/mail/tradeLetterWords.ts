import { MOST_IN_SQUAD } from "../leagues/leagueLimits";
import { andListWords } from "../shared/moments";
import type { TellMoment } from "./letterMoments";
import type { Words } from "./letterShape";

// What trades' Mail letters say (spec/08 Trades, spec/16; #383): split from letterWords.ts, as
// waivers' are (waiverLetterWords.ts). ../trades/ files them.

/** A trade as its letters name it: each team by name, and each side's players, or its one pick,
 *  by name. */
export type TradeWords = {
  fromTeamName: string;
  toTeamName: string;
  /** The players, or the pick, going from the offering team to the other. */
  gives: readonly string[];
  /** The players, or the pick, coming from the other team to the offering one. */
  gets: readonly string[];
  note: string | null;
};

/** A draft pick in a trade (#1096), named by the team whose pick in the round it is: "the Lions
 *  round 3 pick", even once another team holds it. */
export const pickWords = (round: number, teamName: string) => `the ${teamName} round ${round} pick`;

const nobody = (players: readonly string[]) => (players.length === 0 ? "nobody" : andListWords(players));

/** "Lions give Saka and Rice; Tigers give Palmer." */
function sides({ fromTeamName, toTeamName, gives, gets }: TradeWords): string {
  return `${fromTeamName} give ${nobody(gives)}; ${toTeamName} give ${nobody(gets)}.`;
}

const noteWords = ({ note }: TradeWords) => (note === null ? "" : ` The note: "${note}"`);

/** To both managers when an offer is made, or a counter that closes the one before it. */
export function offerLetter(trade: TradeWords, who: string, countered: boolean): Words {
  const made = countered
    ? `${who} countered ${trade.toTeamName}'s offer with this one for ${trade.fromTeamName}, which closes the old offer: ${sides(trade)}`
    : `${who} offered ${trade.toTeamName} a trade for ${trade.fromTeamName}: ${sides(trade)}`;
  return {
    subject: `${trade.fromTeamName} offered ${trade.toTeamName} a trade`,
    body: `${made}${noteWords(trade)} ${trade.toTeamName} can accept, reject or counter it; unanswered, it closes at the next deadline.`,
  };
}

/** Why an offer closed before it was accepted (spec/08; Craig, 6 Nov 2026, on #383). */
export type OfferClosed =
  | { why: "withdrawn" | "rejected" | "deadline" | "tradeDeadline" | "unusedGameweek" | "draftStarted" }
  | { why: "pickTraded"; pickName: string }
  | { why: "autoTeam"; teamName: string }
  | { why: "playerLeft"; playerName: string; teamName: string };

/** To both managers when an offer closes unaccepted, saying why. */
export function offerClosedLetter(trade: TradeWords, closed: OfferClosed): Words {
  const because = (() => {
    switch (closed.why) {
      case "withdrawn":
        return `${trade.fromTeamName} withdrew it.`;
      case "rejected":
        return `${trade.toTeamName} rejected it.`;
      case "deadline":
        return "Nobody answered it by the deadline.";
      case "tradeDeadline":
        return "The league's trade deadline has passed.";
      case "unusedGameweek":
        return "The league is sitting out this gameweek, and trades are locked through it.";
      case "autoTeam":
        return `${closed.teamName} went on the auto team, which trades with nobody.`;
      case "playerLeft":
        return `${closed.playerName} left ${closed.teamName}'s squad.`;
      case "draftStarted":
        return "The draft started, and picks are traded only before it.";
      case "pickTraded":
        return `Another trade took ${closed.pickName}.`;
    }
  })();
  return { subject: `The trade between ${trade.fromTeamName} and ${trade.toTeamName} is closed`, body: `${because} The offer was: ${sides(trade)}` };
}

/** To both managers when the draft starts and undoes their pick trade (#1457): `pickName`, one of
 *  its picks, is in a round past the draft's `rounds`, or went back when an earlier trade was undone. */
export function pickTradeUndoneLetter(trade: TradeWords, pickName: string, undone: { why: "roundCut" | "pickBack" }, rounds: number): Words {
  const because =
    undone.why === "roundCut"
      ? `The draft has ${rounds} rounds, so ${pickName} isn't in it.`
      : `An earlier trade was undone, so ${pickName} went back to the team that held it before.`;
  return {
    subject: `The trade between ${trade.fromTeamName} and ${trade.toTeamName} is undone`,
    body: `${because} Both picks go back to the teams that held them before the trade. The trade was: ${sides(trade)}`,
  };
}

/** Who reviews an accepted trade, as its letters name them. */
export type ReviewWords = { kind: "veto"; by: string } | { kind: "vote" };

/** To both managers when an offer is accepted and goes into review, until `endsAt`. */
export function acceptedLetter(trade: TradeWords, review: ReviewWords, endsAt: number, tell: TellMoment): Words {
  const until = tell(endsAt);
  const who =
    review.kind === "veto"
      ? `${review.by} can block it until ${until}`
      : `the other managers can vote against it until ${until}, and it is blocked only if most of them do`;
  return {
    subject: `${trade.toTeamName} accepted ${trade.fromTeamName}'s trade`,
    body: `${sides(trade)} It is in review: ${who}. If it isn't blocked, the players move then.`,
  };
}

/** To whoever reviews an accepted trade: the one who may block it, or each manager who may vote
 *  against it (spec/08: "with Block in it", "with Against in it"). */
export function reviewLetter(trade: TradeWords, review: ReviewWords, endsAt: number, tell: TellMoment): Words {
  const until = tell(endsAt);
  return review.kind === "veto"
    ? {
        subject: `Block the trade between ${trade.fromTeamName} and ${trade.toTeamName}?`,
        body: `${trade.toTeamName} accepted ${trade.fromTeamName}'s trade: ${sides(trade)} You review it: Block it by ${until}, or it goes through.`,
      }
    : {
        subject: `Vote on the trade between ${trade.fromTeamName} and ${trade.toTeamName}`,
        body: `${trade.toTeamName} accepted ${trade.fromTeamName}'s trade: ${sides(trade)} Vote Against it by ${until} if you think it shouldn't go through. It is blocked only if most of the managers still playing vote against it.`,
      };
}

/** To the whole league when a trade goes through: the usual trade letter (spec/16), naming each
 *  team whose squad it pushes past the league's limits (spec/08: warned, as an assignment is). */
export function tradeMadeLetter(trade: TradeWords, overLimits: readonly string[]): Words {
  const warned = overLimits.length === 0 ? "" : ` ${andListWords(overLimits)} ${overLimits.length === 1 ? "is" : "are"} now outside the league's squad limits.`;
  return {
    subject: `${trade.fromTeamName} and ${trade.toTeamName} traded`,
    body: `${nobody(trade.gives)} to ${trade.toTeamName}; ${nobody(trade.gets)} to ${trade.fromTeamName}.${warned}`,
  };
}

/** To the whole league when a trade is blocked in review. */
export function tradeBlockedLetter(trade: TradeWords, review: ReviewWords): Words {
  const by = review.kind === "veto" ? `${review.by} blocked it` : "Most of the managers voted against it";
  return {
    subject: `The trade between ${trade.fromTeamName} and ${trade.toTeamName} was blocked`,
    body: `${by}, so nobody moves. The trade was: ${sides(trade)}`,
  };
}

/** Why a trade that cleared review can't be made (#1325): a player in it is no longer on his side's
 *  team, moved by the commissioner while it was in review; a team would hold more than the most in
 *  a squad, filled meanwhile by another trade or an assignment; or anything else that stops it. */
export type TradeFailed =
  | { why: "playerGone"; playerName: string; teamName: string }
  | { why: "squadFull"; teamName: string }
  | { why: "error" };

/** To both managers when a trade cleared review but can't be made, saying why. */
export function tradeFailedLetter(trade: TradeWords, failed: TradeFailed): Words {
  const because = (() => {
    switch (failed.why) {
      case "playerGone":
        return `${failed.playerName} is no longer in ${failed.teamName}'s squad`;
      case "squadFull":
        return `${failed.teamName} would hold more than ${MOST_IN_SQUAD} players`;
      case "error":
        return "It couldn't be made";
    }
  })();
  return {
    subject: `The trade between ${trade.fromTeamName} and ${trade.toTeamName} didn't go through`,
    body: `${because}, so nobody moves. The trade was: ${sides(trade)}`,
  };
}
