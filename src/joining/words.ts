// What joining's screens say (#73), in one place for Craig to change in the pull request. Why the
// server refused a change is in convex/joining/joining.ts and convex/shared/leagueAccess.ts, and reaches the
// screen as is.

import type { EndedInvite } from "../../convex/joining/endedInvite";
import type { Delivery } from "../../convex/joining/joining";
import { INVITE_DAYS, aNewTeamWords } from "../../convex/joining/joiningShared";
import { LOCALE } from "../../convex/shared/moments";
import { unsentLinkWords } from "../leagues/words";

/** The commissioner's page: its title, and the link to it from their leagues. */
export const INVITES_TITLE = "Invites and join requests";

/** The team an invite or an approval is for, when it isn't a vacated one. */
export const newTeamWords = "A new team";
export const noTeamWords = "The league is full, with no vacated team to hand on.";
export const forTeamWords = (teamName: string | null) => `For ${teamName ?? aNewTeamWords}`;

export const inviteHint = `They join when they sign in, with no approval. An invite lasts ${INVITE_DAYS} days.`;

const dayFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short" });
/** A day, as the page shows when an invite ends or a request was made: "Tue 27 Oct". */
export const dayWords = (time: number) => dayFormat.format(time);

/** Why an invite waits for tomorrow (spec/13). */
const dayIsSpent = "today's emails have all gone";

/** Where a live invite's email stands. */
export const deliveryWords: Record<Delivery, (expiresAt: number) => string> = {
  sending: () => "Sending…",
  sent: (expiresAt) => `Sent. It lasts until ${dayWords(expiresAt)}.`,
  waiting: () => `Waits for tomorrow: ${dayIsSpent}. It goes by itself.`,
  tryLater: () => `Not sent: ${unsentLinkWords.tryLater}. Resend it later.`,
  notSent: () => `Not sent: ${unsentLinkWords.notSent}. Resend it.`,
};
export const expiredWords = `Expired. Resend it for ${INVITE_DAYS} more days.`;
export const joinedWords = (teamName: string) => `Joined, running ${teamName}.`;
/** A reason as its own sentence after another, or nothing when none was kept. */
const thenReason = (reason: string | null) => (reason === null ? "" : ` ${reason}`);

export const couldNotJoinWords = (reason: string | null) => `Signed in, but couldn't join.${thenReason(reason)}`;

/** "Your leagues" for someone in none, when their newest invite ended without them joining. */
export function endedInviteWords({ leagueName, ended, reason }: EndedInvite): string {
  const how = { expired: "expired.", cancelled: "was cancelled.", couldNotJoin: `couldn't be used.${thenReason(reason)}` }[ended];
  return `Your invite to ${leagueName} ${how} Ask the commissioner for a new one.`;
}

/** The strip telling the commissioner that invites wait for tomorrow (spec/13). */
export const waitingStrip = (waiting: number) =>
  `${waiting === 1 ? "1 invite waits" : `${waiting} invites wait`} for tomorrow: ${dayIsSpent}. They go by themselves.`;

export const loadingWords = "Loading…";
export const notYoursWords = "You don't run this league, or it doesn't exist.";

/** The panel inviting by email: its form, and each invite's controls. */
export const emailInvitesWords = {
  title: "Invite by email",
  emailLabel: "Email",
  teamLabel: "Team",
  send: "Send the invite",
  listLabel: "Invites",
  resend: "Resend",
  resendLabel: (email: string) => `Resend the invite to ${email}`,
  cancel: "Cancel",
  cancelLabel: (email: string) => `Cancel the invite to ${email}`,
} as const;

/** The league's one invite link. */
export const inviteLinkWords = {
  title: "Invite link",
  make: "Make an invite link",
  label: "The league's invite link",
  replace: "Replace the link",
  switchOff: "Switch it off",
} as const;
export const linkHint = "Opening it only asks to join: you approve each request.";

/** The join requests the link made, each approved to a team or refused. */
export const requestsWords = {
  title: "Join requests",
  asked: (askedAt: number) => `Asked ${dayWords(askedAt)}`,
  teamLabel: (email: string) => `Team for ${email}`,
  approve: "Approve",
  approveLabel: (email: string) => `Approve ${email}`,
  refuse: "Refuse",
  refuseLabel: (email: string) => `Refuse ${email}`,
} as const;
export const noRequestsWords = "No one is waiting.";

/** The league's teams, each with its manager, who can be removed (spec/13, Leaving). */
export const teamsWords = {
  title: "Teams",
  noManager: "No manager",
  remove: "Remove",
  removeLabel: (email: string, teamName: string) => `Remove ${email} from ${teamName}`,
  confirm: (email: string, teamName: string) =>
    `Remove ${email} from ${teamName}? They lose the league at once. ${teamName} keeps its name, for you to hand on with an invite or a request.`,
  yes: "Remove them",
  no: "Keep them",
} as const;
export const noInvitesWords = "No invites yet.";

/** The sign-in page, opened from an invite link while signed out. */
export const signInToJoinWords = "Sign in with your email, and the link brings you back here to ask to join the league.";

export const joinPageWords = {
  title: "Join a league",
  loading: loadingWords,
  mayAsk: (leagueName: string) => `Ask to join ${leagueName}. Its commissioner approves each request.`,
  ask: "Ask to join",
  waiting: (leagueName: string) =>
    `Your request to join ${leagueName} is waiting for the commissioner. You'll get an email once it's approved.`,
  inLeague: (leagueName: string, teamName: string) => `You're in ${leagueName}, running ${teamName}.`,
} as const;
