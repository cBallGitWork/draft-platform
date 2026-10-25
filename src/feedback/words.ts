// What feedback's screens say, in one place for Craig to change in the pull request. Why the
// server refused a message is in convex/feedback/feedback.ts (`feedbackRefusals`), and reaches the
// screen as is.

import { failedWords } from "../words";

/** The top bar's link, and the page it opens. */
export const feedbackLinkWords = "Feedback";
export const FEEDBACK_TITLE = "Feedback";
export const feedbackHint = "Tell the admin what's wrong or what you'd like. Only he reads it, on his dashboard.";
export const messageLabel = "Your feedback";
export const sendWords = "Send";
export const sentWords = "Sent to the admin. Thank you.";
/** When sending failed before the server could say why: the connection, or the server itself. */
export const sendFailedWords = failedWords("your feedback wasn't sent");

