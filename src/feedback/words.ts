// What feedback's screens say, in one place for Craig to change in the pull request. Why the
// server refused a message is in convex/feedback/feedback.ts (`feedbackRefusals`), and reaches the
// screen as is.

import { failedWords } from "../shared/words";

/** The page the top bar's link opens, and the link, named for it; the admin's tab is too. */
export const FEEDBACK_TITLE = "Feedback";
export const feedbackLinkWords = FEEDBACK_TITLE;
export const feedbackHint = "Tell the admin what's wrong or what you'd like. Only he reads it, on his dashboard.";
export const messageLabel = "Your feedback";
export const sendWords = "Send";
export const sentWords = "Sent to the admin. Thank you.";
/** What a send that failed left, and what the preview's send leaves. */
export const notSentWords = "your feedback wasn't sent";
/** When sending failed before the server could say why: the connection, or the server itself. */
export const sendFailedWords = failedWords(notSentWords);

