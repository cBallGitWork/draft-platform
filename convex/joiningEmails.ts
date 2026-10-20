import { INVITE_DAYS } from "./joiningShared";
import { PRODUCT_NAME } from "./signInEmail";

// Joining's emails (#73), in words for Craig to change in the pull request: an invite, which
// carries a sign-in link, and the one telling a person their join request was approved.

/** What an invite's email says of it. */
export type InviteFacts = { leagueName: string; invitedBy: string; teamName: string | null };

const forTeam = (teamName: string | null) => (teamName === null ? "a new team" : teamName);

export function inviteEmail(url: string, { leagueName, invitedBy, teamName }: InviteFacts) {
  return {
    subject: `You're invited to ${leagueName} on ${PRODUCT_NAME}`,
    text: [
      `${invitedBy} has invited you to run ${forTeam(teamName)} in ${leagueName} on ${PRODUCT_NAME}.`,
      "This link signs you in, and you're in the league:",
      "",
      url,
      "",
      "The link works once, within an hour, on any device. After that, open",
      `${siteUrl()} and ask for a new one with this email: the invite lasts ${INVITE_DAYS} days.`,
    ].join("\n"),
  };
}

export function approvedEmail({ leagueName, teamName }: { leagueName: string; teamName: string }) {
  return {
    subject: `You're in ${leagueName} on ${PRODUCT_NAME}`,
    text: [
      `The commissioner approved your request to join ${leagueName}: you run ${teamName}.`,
      "",
      siteUrl(),
    ].join("\n"),
  };
}

function siteUrl(): string {
  const url = process.env.SITE_URL;
  if (!url) throw new Error("SITE_URL isn't set on this deployment, so an email can't say where the app is");
  return url;
}
