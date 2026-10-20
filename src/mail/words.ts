// What the Mail screen says, in one place for Craig to change. Why the server refused a letter is
// in convex/mail.ts (`mailRefusals`), and reaches the screen as is. What the letters about a
// league's events say is in convex/letterWords.ts.

import { LETTERS_SHOWN, UNREAD_COUNTED } from "../../convex/mailLimits";

export const MAIL_TITLE = "Mail";
export const noLettersWords = "No letters yet. When something happens in your league, it's reported here.";
export const loadingWords = "Fetching your Mail…";
export const unreadWords = "Unread";
export const onlyLatestWords = `Only your latest ${LETTERS_SHOWN} letters are shown.`;

/** The menu's and the plate's count: past UNREAD_COUNTED, that number and a "+". */
export const unreadFigure = (unread: number) => (unread > UNREAD_COUNTED ? `${UNREAD_COUNTED}+` : `${unread}`);
export const unreadCount = (unread: number) => `${unreadFigure(unread)} unread`;

/** Where a letter came from: its league, and who wrote it, if someone did. */
export const letterSource = (leagueName: string, from: string | null) => (from === null ? leagueName : `${leagueName}, from ${from}`);

const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
/** When a letter was filed, in the reader's own time: "20 Oct" and "09:00". */
export const letterDay = (at: number) => day.format(at);
export const letterTime = (at: number) => time.format(at);

export const WRITE_TITLE = "Write to the league";
export const writeHint = "Everyone in the league gets it in their Mail. They can't reply: there is no chat.";
export const sentWords = (leagueName: string) => `Sent to everyone in ${leagueName}.`;
/** When sending failed before the server could say why: the connection, or the server itself. */
export const sendFailedWords = "Something went wrong, so the letter wasn't sent. Check your connection and try again.";
