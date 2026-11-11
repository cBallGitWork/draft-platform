import { unreadCount } from "../../mail/words";
import { MAIL_PATH, MY_TEAM_PATH, TRADES_PATH } from "../menu";
import { menuWords } from "../words";

// What the top bar tells a signed-in manager: Mail's unread count, and where Continue goes.
// Mail (#26) feeds the count (src/mail/liveMail.ts); the server says whether his lineup is due
// (convex/lineup/lineupDue.ts, #526) and how many trade offers wait for his answer
// (convex/trades/tradeOffers.ts, #1553); liveTopBar.tsx puts them together.

export type NextStep = { path: string; reason: string };
export type TopBarState = {
  unreadMail: number;
  next: NextStep | null;
  /** The manager's pending waiver claims, which My team's Transactions tab counts while there are
   *  any (#1200; Craig, 8 Nov 2026: "Yes 1 and 2"); none where not said. */
  pendingClaims?: number;
};

/** Where Continue goes, in spec/12's order: an unread letter, then a lineup before the deadline
 *  (his Tactics tab, My team's own page), then a trade offer waiting for his answer (the Offers
 *  tab); with none, nowhere. */
export function nextStep({ unreadMail, lineupDue, offersWaiting }: { unreadMail: number; lineupDue: boolean; offersWaiting: number }): NextStep | null {
  if (unreadMail > 0) return { path: MAIL_PATH, reason: unreadCount(unreadMail) };
  if (lineupDue) return { path: MY_TEAM_PATH, reason: menuWords.tactics };
  if (offersWaiting > 0) return { path: TRADES_PATH, reason: menuWords.offers };
  return null;
}
