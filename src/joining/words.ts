// What joining's screens say (#73), in one place for Craig to change in the pull request. Why the
// server refused a change is in convex/joining/joining.ts and convex/shared/leagueAccess.ts, and reaches the
// screen as is.

import type { EndedInvite } from "../../convex/joining/endedInvite";
import type { Delivery } from "../../convex/joining/joining";
import { INVITE_DAYS, ROWS_SHOWN, aNewTeamWords } from "../../convex/joining/joiningShared";
import { unsentLinkWords } from "../leagues/words";
import { capitalised } from "../../convex/shared/moments";
import { noManagerWords } from "../shared/words";
import { dateWords } from "../shared/when/words";

/** The commissioner's page: its title, and the link to it from their leagues. */
export const INVITES_TITLE = "Invites and join requests";

/** The team an invite or an approval is for, when it isn't a vacated one. */
export const newTeamWords = capitalised(aNewTeamWords);
export const noTeamWords = "The league is full, and no team is free to hand on.";
export const forTeamWords = (teamName: string | null) => `For ${teamName ?? aNewTeamWords}`;

export const inviteHint = `No approval needed. An invite lasts ${INVITE_DAYS} days.`;

/** Why an invite waits for tomorrow (spec/13). */
const dayIsSpent = "Today's emails have all gone.";

/** Where a live invite's email stands. */
export const deliveryWords: Record<Delivery, (expiresAt: number) => string> = {
  sending: () => "Sending…",
  sent: (expiresAt) => `Sent. It lasts until ${dateWords(expiresAt)}.`,
  waiting: () => `${dayIsSpent} It goes out tomorrow.`,
  tryLater: () => `Not sent: ${unsentLinkWords.tryLater}. Resend it later.`,
  notSent: () => `Not sent: ${unsentLinkWords.notSent}. Resend it.`,
};
export const expiredWords = `Expired. Resend it for ${INVITE_DAYS} more days.`;
export const joinedWords = (teamName: string) => `Joined, running ${teamName}.`;
/** A reason as its own sentence after another, or nothing when none was kept. */
const thenReason = (reason: string | null) => (reason === null ? "" : ` ${reason}`);

export const couldNotJoinWords = (reason: string | null) => `Signed in, but couldn't join.${thenReason(reason)}`;

/** "Your leagues" for someone in none, when their newest invite is live but a sign-in's fault kept
 *  them from joining (Craig, 12 Nov 2026, on #1437). */
export const joinFailedWords = "Couldn't add you to the league. Open your invite link again.";

/** "Your leagues" for someone in none, when their newest invite ended without them joining, or a
 *  fault kept them from joining by it. */
export function endedInviteWords({ leagueName, ended, reason }: EndedInvite): string {
  if (ended === "joinFailed") return joinFailedWords;
  const how = { expired: "expired.", cancelled: "was cancelled.", couldNotJoin: `couldn't be used.${thenReason(reason)}` }[ended];
  return `Your invite to ${leagueName} ${how} Ask the commissioner for a new one.`;
}

/** The strip telling the commissioner that invites wait for tomorrow (spec/13). */
export const waitingStrip = (waiting: number) =>
  `${dayIsSpent} ${waiting === 1 ? "1 invite goes" : `${waiting} invites go`} out tomorrow.`;

/** The strips saying the page lists only the newest ROWS_SHOWN of each (#410). */
export const invitesCutWords = `Showing the newest ${ROWS_SHOWN} live invites. Older ones aren't listed.`;
export const requestsCutWords = `Showing the newest ${ROWS_SHOWN} join requests. Older ones aren't listed.`;

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
export const linkHint = "Opening it only asks to join. You approve each request.";

/** The join requests the link made, each approved to a team or refused. */
export const requestsWords = {
  title: "Join requests",
  asked: (askedAt: number) => `Asked ${dateWords(askedAt)}`,
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
  noManager: noManagerWords,
  remove: "Remove",
  removeLabel: (email: string, teamName: string) => `Remove ${email} from ${teamName}`,
  confirm: (email: string, teamName: string) =>
    `Remove ${email} from ${teamName}? They leave the league at once. ${teamName} keeps its name, and you can hand it on with an invite or a request.`,
  yes: "Remove them",
  no: "Keep them",
} as const;
export const noInvitesWords = "No invites yet.";

/** The sign-in page, opened from an invite link while signed out. */
export const signInToJoinWords = "Sign in to ask to join.";

export const joinPageWords = {
  title: "Join a league",
  loading: loadingWords,
  commissioner: "Commissioner",
  teams: "Teams",
  /** Follows the "3 of 8" figures, as Your leagues sets them. */
  teamsAfter: " teams",
  ask: "Ask to join",
  /** The side panel saying how joining goes, as the approved picture words it. */
  joiningTitle: "Joining",
  joining: "The commissioner approves each request. You get an email once you are in.",
  waiting: (leagueName: string) =>
    `Your request to join ${leagueName} is waiting for the commissioner. You'll get an email once it's approved.`,
  inLeague: (leagueName: string, teamName: string) => `You're in ${leagueName}, running ${teamName}.`,
} as const;

/** Your leagues' side panels, as its approved pictures word them (docs/design/approved/leagues). */
export const yourJoinRequestWords = {
  title: "Your join request",
  waiting: "Waiting for its commissioner. You get an email once you are approved.",
} as const;
export const joiningALeagueWords = {
  title: "Joining a league",
  how: "You join from a commissioner's emailed invite, or their league's invite link.",
} as const;
