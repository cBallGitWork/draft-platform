// Joining's tests' shared setup (#73): invites sent and their emails' links opened, the invite
// link made and asked from, as people do.

import { vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { COMMISSIONER, actingAs, type TestConvex } from "./leagues.harness";
import { linkCode, openLink, type SentEmail } from "./signIn.harness";

/** The league's commissioner, signed in. */
export const asCommissioner = (t: TestConvex) => actingAs(t, COMMISSIONER);

/** The commissioner invites `email`, to a vacated team or a new one, and the email is sent. */
export async function invite(t: TestConvex, leagueId: Id<"leagues">, email: string, teamId?: Id<"teams">) {
  const inviteId = await (await asCommissioner(t)).mutation(api.joining.invites.send, { leagueId, email, teamId });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return inviteId;
}

/** Every email sent to this address, oldest first. */
export const emailsTo = (sent: SentEmail[], email: string) => sent.filter((each) => each.to === email);

/** The last email sent to this address. */
export function lastEmailTo(sent: SentEmail[], email: string): SentEmail {
  const last = emailsTo(sent, email).at(-1);
  if (!last) throw new Error(`no email was sent to ${email}`);
  return last;
}

/** Runs what is scheduled to run now, and nothing later, such as what waits for tomorrow. */
export async function finishWhatIsDueNow(t: TestConvex) {
  vi.runOnlyPendingTimers();
  await t.finishInProgressScheduledFunctions();
}

/** Opens the link in the last email sent to this address: its tokens, or null if refused. */
export const openLastLinkTo = (t: TestConvex, sent: SentEmail[], email: string) => openLink(t, linkCode(lastEmailTo(sent, email)));

/** The commissioner's invites page, as `as` sees it. */
export async function invitesPage(t: TestConvex, leagueId: Id<"leagues">, as = COMMISSIONER) {
  return (await actingAs(t, as)).query(api.joining.invitesPage.page, { leagueId });
}

/** The commissioner makes the league's invite link, replacing any: its token. */
export async function makeLink(t: TestConvex, leagueId: Id<"leagues">): Promise<string> {
  await (await asCommissioner(t)).mutation(api.joining.inviteLink.make, { leagueId });
  const token = (await invitesPage(t, leagueId))?.linkToken;
  if (!token) throw new Error("making the invite link left the league with none");
  return token;
}

/** The invite link's page, as `email`, signed in, sees it. */
export async function joinPageAs(t: TestConvex, email: string, token: string) {
  return (await actingAs(t, email)).query(api.joining.joinRequests.joinPage, { token });
}

/** `email`, signed in, asks to join from the invite link: the request the commissioner sees. */
export async function askToJoin(t: TestConvex, leagueId: Id<"leagues">, token: string, email: string) {
  await (await actingAs(t, email)).mutation(api.joining.joinRequests.ask, { token });
  const request = (await invitesPage(t, leagueId))?.requests.find((each) => each.email === email);
  if (!request) throw new Error(`${email} asked to join, and the commissioner sees no request`);
  return request.requestId;
}
