// Joining's screens without Convex, for screenshots (src/preview.ts says how): the preview
// manager's league "Mini beta", which they commission, at /leagues/preview-mini-beta/invites;
// its invite link at /join/preview, or /join/waiting once asked, or /join/gone once switched off.

import type { Id } from "../../convex/_generated/dataModel";
import { DAY_MS } from "../../convex/shared/time";
import { miniBeta, previewSays } from "../preview";
import { replyWords } from "../sign-in/words";
import type { InvitesPageData, JoiningSeam } from "./seam";

const now = Date.now();
const id = <Table extends "teams" | "invites" | "joinRequests">(value: string) => value as Id<Table>;

const invitesPage: InvitesPageData = {
  leagueId: miniBeta.leagueId,
  leagueName: miniBeta.name,
  teams: [
    { teamId: id("team-1"), name: "Team 1", vacated: false },
    { teamId: id("team-2"), name: "Saka Potatoes", vacated: true },
  ],
  hasRoom: true,
  linkToken: "preview",
  invites: [
    { inviteId: id("invite-1"), email: "ann@example.com", teamName: null, delivery: "sent", expiresAt: now + 6 * DAY_MS, joinedTeamName: null, couldNotJoin: null },
    { inviteId: id("invite-2"), email: "bob@example.com", teamName: "Saka Potatoes", delivery: "waiting", expiresAt: now + 7 * DAY_MS, joinedTeamName: null, couldNotJoin: null },
    { inviteId: id("invite-3"), email: "cat@example.com", teamName: null, delivery: "sent", expiresAt: now - DAY_MS, joinedTeamName: null, couldNotJoin: null },
    { inviteId: id("invite-4"), email: "dan@example.com", teamName: null, delivery: "sent", expiresAt: now + 5 * DAY_MS, joinedTeamName: "Team 1", couldNotJoin: null },
  ],
  requests: [{ requestId: id("request-1"), email: "a.very.long.address.for.the.phone@example.com", askedAt: now - DAY_MS }],
};

const nothingChanged = previewSays("nothing changed");

export const previewJoining: JoiningSeam = {
  useInvitesPage: (leagueId) => (leagueId === invitesPage.leagueId ? invitesPage : null),
  useJoinPage: (token) => {
    if (token === "gone") return null;
    return { leagueName: invitesPage.leagueName, standing: token === "waiting" ? "waiting" : "mayAsk" };
  },
  invite: nothingChanged,
  resendInvite: nothingChanged,
  cancelInvite: nothingChanged,
  makeLink: nothingChanged,
  switchOffLink: nothingChanged,
  approve: nothingChanged,
  refuse: nothingChanged,
  askToJoin: nothingChanged,
  signInToJoin: async () => replyWords.checkYourEmail,
};
