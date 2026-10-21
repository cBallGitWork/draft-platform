// The seam for joining a league (#73): what the screens can read and ask of invites, the invite
// link and join requests. Convex fills it in live (liveJoining.ts); the preview and the tests
// hand the screens their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { InvitesPageData } from "../../convex/invitesPage";
import type { JoinPageData } from "../../convex/joinRequests";
import type { Change } from "../refusal";

export type { InvitesPageData, JoinPageData };

export type JoiningSeam = {
  /** The league's invites page, live (a hook): undefined while it loads, null when the person
   *  doesn't run the league. */
  useInvitesPage(leagueId: string): InvitesPageData | null | undefined;
  /** The invite link's page, live (a hook): undefined while it loads, null once the link no
   *  longer works. */
  useJoinPage(token: string): JoinPageData | undefined;
  /** Invites an email to the vacated team `teamId`, or to a new team when it's null. */
  invite(leagueId: Id<"leagues">, email: string, teamId: Id<"teams"> | null): Change;
  resendInvite(inviteId: Id<"invites">): Change;
  cancelInvite(inviteId: Id<"invites">): Change;
  /** Makes the league's invite link, replacing any. */
  makeLink(leagueId: Id<"leagues">): Change;
  switchOffLink(leagueId: Id<"leagues">): Change;
  /** Approves a join request, to the vacated team `teamId`, or a new team when it's null. */
  approve(requestId: Id<"joinRequests">, teamId: Id<"teams"> | null): Change;
  refuse(requestId: Id<"joinRequests">): Change;
  askToJoin(token: string): Change;
  /** Asks for a sign-in link that leads back to the invite link, and resolves with what to tell
   *  the visitor. It never rejects. */
  signInToJoin(token: string, email: string): Promise<string>;
};
