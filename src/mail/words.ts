// What the Mail screen says, in one place for Craig to change. Why the server refused a letter is
// in convex/mail/mail.ts (`mailRefusals`), and reaches the screen as is. What the letters about a
// league's events say is in convex/mail/letterWords.ts.

import { LEAGUES_SHOWN } from "../../convex/leagues/leagueLimits";
import { LETTERS_SHOWN, UNREAD_COUNTED } from "../../convex/mail/mailLimits";
import type { LetterKind } from "../../convex/mail/letterShape";
import { failedWords, notHeldLabel } from "../shared/words";
import { dateWords, dayWords, timeOfDayWords } from "../shared/when/words";

export { MAIL_TITLE } from "../shared/words";
export const noLettersWords = "No letters yet.";
export const loadingWords = "Fetching your Mail…";
export const unreadWords = "Unread";
export const onlyLatestWords = `Showing your latest ${LETTERS_SHOWN} letters.`;

/** The menu's and the plate's count: past UNREAD_COUNTED, that number and a "+". */
export const unreadFigure = (unread: number) => (unread > UNREAD_COUNTED ? `${UNREAD_COUNTED}+` : `${unread}`);
export const unreadCount = (unread: number) => `${unreadFigure(unread)} unread`;
/** A menu tab with unread letters, as a screen reader names it: "Mail, 3 unread". */
export const unreadTabLabel = (label: string, unread: number) => `${label}, ${unreadCount(unread)}`;

/** Who a letter is from: whoever wrote it, or else its league, or the site for a letter from it. */
export const senderWords = (leagueName: string, from: string | null) => from ?? leagueName;
/** The open letter's plate: "From Kroos Control". */
export const fromWords = (sender: string) => `From ${sender}`;
/** The open letter's one link, its last line (S16.2; approved/mail, The one link). */
export const openOfferWords = "Open the offer in Trades";
/** A commissioner's letter in a league with none ends offering to take the role (spec/01 S01.2,
 *  S01.3), and once asked says it waits. */
export const askToRunWords = "Ask to be commissioner";
export const askedToRunWords = "Asked to be commissioner";

/** When a letter was filed, in the reader's own time: "20 Oct" and "9am"; the day its group in
 *  the list stands under, "Tue 10 Nov"; and when the open letter came, "Tue 10 Nov, 8.12am". */
export const letterDay = dayWords;
export const letterTime = timeOfDayWords;
export const letterDate = dateWords;
export const letterWhen = (at: number) => `${dateWords(at)}, ${timeOfDayWords(at)}`;

/** The tabs on Mail's plate (the approved picture), Unread with its count. */
export const MAIL_TABS = ["all", "unread"] as const;
export type MailTab = (typeof MAIL_TABS)[number];
export const mailTabsLabel = "Which letters";
export const mailTabWords = (unread: number): Record<MailTab, string> => ({ all: "All", unread: `Unread (${unreadFigure(unread)})` });
export const LETTERS_TITLE = "Letters";
export const noUnreadWords = "No unread letters.";
export const noLetterOpenWords = "No letter open.";
/** A letter's kind chip (the approved picture's Trade, Waivers, Commissioner). */
export const letterKindWords = {
  trade: "Trade",
  waivers: "Moves", // bids, signings and drops alike
  assigned: "Assigned",
  commissioner: "Commissioner",
  league: "League",
  draft: "Draft",
  lineup: "Line-up", // literal-ok: a Mail kind, not the matchup panel's title
  positions: "Positions",
  scout: "Scout",
  recap: "Recap",
  patch: "Scoring",
} as const satisfies Record<LetterKind, string>;
/** The kind chip's placeholder, on a letter filed before letters held their kind. */
export const kindPlaceholderLabel = notHeldLabel("Kind");

export const WRITE_TITLE = "Write to the league";
export const writeHint = "Nobody can reply. There's no chat.";
export const writeLabels = { league: "League", subject: "Subject", body: "Letter" } as const;
export const sendToWords = (leagueName: string) => `Send to ${leagueName}`;
/** When the person's leagues stop short (#297), so one they run may be missing from the letter's. */
export const leaguesCutFromWords = `You can write to your first ${LEAGUES_SHOWN} leagues from here.`;
export const sentWords = (leagueName: string) => `Sent to everyone in ${leagueName}.`;
/** When sending failed before the server could say why: the connection, or the server itself. */
export const sendFailedWords = failedWords("the letter wasn't sent");
