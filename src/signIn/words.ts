// What sign-in says, in one place for Craig to change in the pull request (spec/02). The email
// itself is convex/signIn/signInEmail.ts.

import { PRODUCT_NAME } from "../../convex/shared/product";
import { hoursWords } from "../../convex/shared/time";
import { LINK_LIFETIME_MS } from "../../convex/signIn/signInLimits";
import { failedWords } from "../shared/words";

/** The sign-in page: the top bar's "Invite only", the form asking for a link, and the Invite only
 *  panel beside it (approved/sign-in/1440.png). */
export const signInWords = {
  inviteOnly: "Invite only",
  title: "Sign in",
  emailLabel: "Your email",
  hint: `We email you a link that signs you in. It works once, within ${hoursWords(LINK_LIFETIME_MS)}.`,
  send: "Email me a link",
  inviteOnlyWhy: `${PRODUCT_NAME} is invite only while it is in beta. A league's commissioner brings you in.`,
  noInvite: "No invite? Ask your commissioner for the league's invite link, or for an emailed invite.",
} as const;

/** The reply to asking for a link, one for each of `signIn/signInLinks:ask`'s answers. `checkYourEmail`
 *  goes to every email, on the list or not, so nobody can tell which are on it. */
export const replyWords = {
  checkYourEmail: `Check your email. If this address can sign in, a link is on its way. It works once, within ${hoursWords(LINK_LIFETIME_MS)}.`,
  tryLater: "Too many links have been asked for this email in the last hour. Try again later.",
  paused: "Sign-in links are paused until tomorrow: today's emails have all been sent.",
  notSent: "The link couldn't be sent. Try again in a few minutes.",
} as const;

/** When asking failed before Convex could answer: the connection, or the server itself. */
export const askFailedWords = failedWords("no link was sent");

/** What the app says while it waits: on a link's code, or on Convex. */
export const waitingWords = {
  checkingLink: "Checking your sign-in link…",
  connecting: "Connecting…",
} as const;

/** What the sign-in page says when a link from an email didn't sign the visitor in. */
export const linkProblemWords = {
  expired: "That sign-in link has expired. Send yourself a new one.",
  unchecked: "Your sign-in link couldn't be checked. Open it again, or send yourself a new one.",
} as const;

export type LinkProblem = keyof typeof linkProblemWords;
