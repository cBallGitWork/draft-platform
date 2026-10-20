// What joining's screens say (#73), in one place for Craig to change in the pull request. Why the
// server refused a change is in convex/joining.ts and convex/leagueAccess.ts, and reaches the
// screen as is.

import type { Delivery } from "../../convex/joining";
import { INVITE_DAYS } from "../../convex/joiningShared";
import { unsentLinkWords } from "../leagues/words";

/** The commissioner's page: its title, and the link to it from their leagues. */
export const invitesTitle = "Invites and join requests";

/** The team an invite or an approval is for, when it isn't a vacated one. */
export const newTeamWords = "A new team";
export const noTeamWords = "The league is full, with no vacated team to hand on.";
export const forTeamWords = (teamName: string | null) => `For ${teamName ?? "a new team"}`;

export const inviteHint = `They join when they sign in, with no approval. An invite lasts ${INVITE_DAYS} days.`;

const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
/** A day, as the page shows when an invite ends or a request was made: "Tue 27 Oct". */
export const dayWords = (time: number) => dayFormat.format(time);

/** Where a live invite's email stands. */
export const deliveryWords: Record<Delivery, (expiresAt: number) => string> = {
  sending: () => "Sending…",
  sent: (expiresAt) => `Sent. It lasts until ${dayWords(expiresAt)}.`,
  waiting: () => "Waits for tomorrow: today's emails have all gone. It goes by itself.",
  tryLater: () => `Not sent: ${unsentLinkWords.tryLater}. Resend it later.`,
  notSent: () => `Not sent: ${unsentLinkWords.notSent}. Resend it.`,
};
export const expiredWords = `Expired. Resend it for ${INVITE_DAYS} more days.`;
export const joinedWords = (teamName: string) => `Joined, running ${teamName}.`;
export const couldNotJoinWords = (reason: string) => `Signed in, but couldn't join: ${reason}`;

/** The strip telling the commissioner that invites wait for tomorrow (spec/13). */
export const waitingStrip = (waiting: number) =>
  `${waiting === 1 ? "1 invite waits" : `${waiting} invites wait`} for tomorrow: today's emails have all gone. ` +
  "They go by themselves.";

export const loadingWords = "Loading…";
export const notYoursWords = "You don't run this league, or it doesn't exist.";

export const linkHint = "Share it, say in the group chat. Opening it only asks to join: you approve each request.";
export const noLinkWords = "The league has no invite link.";
export const noRequestsWords = "No one is waiting.";
export const noInvitesWords = "No invites yet.";

/** The sign-in page, opened from an invite link while signed out. */
export const signInToJoinWords = "Sign in with your email, and the link brings you back here to ask to join the league.";

export const joinPageWords = {
  title: "Join a league",
  loading: loadingWords,
  mayAsk: (leagueName: string) => `Ask to join ${leagueName}. Its commissioner approves each request.`,
  waiting: (leagueName: string) =>
    `Your request to join ${leagueName} is waiting for the commissioner. You'll get an email once it's approved.`,
  inLeague: (leagueName: string, teamName: string) => `You're in ${leagueName}, running ${teamName}.`,
} as const;

/** When a change failed before the server could say why: the connection, or the server itself. */
export const changeFailedWords = "Something went wrong, so nothing changed. Check your connection and try again.";
