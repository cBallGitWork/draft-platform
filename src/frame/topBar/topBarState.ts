import { unreadCount } from "../../mail/words";
import { MAIL_PATH, MY_TEAM_PATH } from "../menu";
import { menuWords } from "../words";

// What the top bar tells a signed-in manager: Mail's unread count, and where Continue goes.
// Mail (#26) feeds the count (src/mail/liveMail.ts) and the server says whether his lineup is due
// (convex/lineup/lineupDue.ts, #526); liveTopBar.ts puts them together. Trades aren't built.

export type NextStep = { path: string; reason: string };
export type TopBarState = { unreadMail: number; next: NextStep | null };

/** Where Continue goes, in spec/12's order: an unread letter, then a lineup before the deadline
 *  (his Tactics tab, My team's own page); with neither, nowhere. */
export function nextStep({ unreadMail, lineupDue }: { unreadMail: number; lineupDue: boolean }): NextStep | null {
  if (unreadMail > 0) return { path: MAIL_PATH, reason: unreadCount(unreadMail) };
  if (lineupDue) return { path: MY_TEAM_PATH, reason: menuWords.tactics };
  return null;
}
