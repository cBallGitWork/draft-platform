// What the Mail screen says, in one place for Craig to change. Why the server refused a letter is
// in convex/mail/mail.ts (`mailRefusals`), and reaches the screen as is. What the letters about a
// league's events say is in convex/mail/letterWords.ts.

import { LETTERS_SHOWN, UNREAD_COUNTED } from "../../convex/mail/mailLimits";
import { LOCALE } from "../../convex/shared/moments";
import { failedWords, timeOfDayWords } from "../shared/words";

export const MAIL_TITLE = "Mail";
export const noLettersWords = "No letters yet.";
export const loadingWords = "Fetching your Mail…";
export const unreadWords = "Unread";
export const onlyLatestWords = `Only your latest ${LETTERS_SHOWN} letters are shown.`;

/** The menu's and the plate's count: past UNREAD_COUNTED, that number and a "+". */
export const unreadFigure = (unread: number) => (unread > UNREAD_COUNTED ? `${UNREAD_COUNTED}+` : `${unread}`);
export const unreadCount = (unread: number) => `${unreadFigure(unread)} unread`;
/** A menu tab with unread letters, as a screen reader names it: "Mail, 3 unread". */
export const unreadTabLabel = (label: string, unread: number) => `${label}, ${unreadCount(unread)}`;

/** Where a letter came from: its league, and who wrote it, if someone did. */
export const letterSource = (leagueName: string, from: string | null) => (from === null ? leagueName : `${leagueName}, from ${from}`);

const day = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" });
/** When a letter was filed, in the reader's own time: "20 Oct" and "09:00". */
export const letterDay = (at: number) => day.format(at);
export const letterTime = timeOfDayWords;

export const WRITE_TITLE = "Write to the league";
export const writeHint = "No one can reply: there is no chat.";
export const writeLabels = { league: "League", subject: "Subject", body: "Letter" } as const;
export const sendToWords = (leagueName: string) => `Send to ${leagueName}`;
export const sentWords = (leagueName: string) => `Sent to everyone in ${leagueName}.`;
/** When sending failed before the server could say why: the connection, or the server itself. */
export const sendFailedWords = failedWords("the letter wasn't sent");
