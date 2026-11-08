import { INVITE_DAYS, aNewTeamWords } from "./joiningShared";
import { PRODUCT_NAME } from "../shared/product";
import { SITE_URL_SETTING } from "../outbound/deploymentSettings";
import { momentIn } from "../shared/moments";
import { hoursWords } from "../shared/time";
import { LINK_LIFETIME_MS } from "../signIn/signInLimits";

// Joining's emails (#73), in words for Craig to change in the pull request: an invite, which
// carries a sign-in link, and the one telling a person their join request was approved.

/** What an invite's email says of it. */
export type InviteFacts = { leagueName: string; invitedBy: string; teamName: string | null };

/** The subject ends with `sentAt`, as a sign-in email's does (signInEmail.ts), so Gmail never folds
 *  a resent invite into the conversation of the first (#973). The sender passes the time in: the
 *  query that builds these words can't read the clock. */
export function inviteEmail(url: string, { leagueName, invitedBy, teamName }: InviteFacts, sentAt: number) {
  return {
    subject: `You're invited to ${leagueName} on ${PRODUCT_NAME}, ${momentIn(sentAt, undefined)}`,
    text: [
      `${invitedBy} has invited you to run ${teamName ?? aNewTeamWords} in ${leagueName} on ${PRODUCT_NAME}.`,
      "This link signs you in, and you're in the league:",
      "",
      url,
      "",
      `The link works once, within ${hoursWords(LINK_LIFETIME_MS)}, on any device. After that, open`,
      `${siteUrl()} and ask for a new one with this email: the invite lasts ${INVITE_DAYS} days.`,
    ].join("\n"),
  };
}

/** Its subject ends with `sentAt` too, as an invite's does, so a second approval into the same
 *  league never folds into the first (#1052). */
export function approvedEmail({ leagueName, teamName }: { leagueName: string; teamName: string }, sentAt: number) {
  return {
    subject: `You're in ${leagueName} on ${PRODUCT_NAME}, ${momentIn(sentAt, undefined)}`,
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
