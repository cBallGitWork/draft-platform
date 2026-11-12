import { INVITE_DAYS, aNewTeamWords } from "./joiningShared";
import { PRODUCT_NAME } from "../shared/product";
import { SITE_URL_SETTING } from "../outbound/deploymentSettings";
import { datedSubject } from "../outbound/email";
import { LINK_WORKS_WORDS } from "../signIn/signInEmail";

// Joining's emails (#73), in words for Craig to change in the pull request: an invite, which
// carries a sign-in link, and the one telling a person their join request was approved.

/** What an invite's email says of it. */
export type InviteFacts = { leagueName: string; invitedBy: string; teamName: string | null };

/** The subject ends with `sentAt` (datedSubject). The sender passes the time in: the query that
 *  builds these words can't read the clock. */
export function inviteEmail(url: string, { leagueName, invitedBy, teamName }: InviteFacts, sentAt: number) {
  return {
    subject: datedSubject(`You're invited to ${leagueName} on ${PRODUCT_NAME}`, sentAt),
    text: [
      `${invitedBy} has invited you to run ${teamName ?? aNewTeamWords} in ${leagueName} on ${PRODUCT_NAME}.`,
      "This link signs you in, and you're in the league:",
      "",
      url,
      "",
      `The link ${LINK_WORKS_WORDS}. After that, open`,
      `${siteUrl()} and ask for a new one with this email: the invite lasts ${INVITE_DAYS} days.`,
    ].join("\n"),
  };
}

/** Its subject ends with `sentAt` too (datedSubject). */
export function approvedEmail({ leagueName, teamName }: { leagueName: string; teamName: string }, sentAt: number) {
  return {
    subject: datedSubject(`You're in ${leagueName} on ${PRODUCT_NAME}`, sentAt),
    text: [
      `The commissioner approved your request to join ${leagueName}: you run ${teamName}.`,
      "",
      siteUrl(),
    ].join("\n"),
  };
}

function siteUrl(): string {
  const url = process.env[SITE_URL_SETTING];
  if (!url) throw new Error(`${SITE_URL_SETTING} isn't set on this deployment, so an email can't say where the app is`);
  return url;
}
