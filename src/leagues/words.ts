// What the league screens say, in one place for Craig to change in the pull request. Why the
// server refused a change is in convex/leagueAccess.ts (`refusals`), and reaches the screen as is.

import { DELETION_UNDO_HOURS, FEWEST_TEAMS, MOST_TEAMS } from "../../convex/leagueLimits";
import { londonTime } from "../../convex/londonTime";
import type { LeagueSummary } from "../../convex/myLeagues";
import type { NoLinkReply } from "../../convex/signInLinks";

export const roleWords: Record<LeagueSummary["roles"][number], string> = {
  commissioner: "Commissioner",
  "co-commissioner": "Co-commissioner",
  manager: "Manager",
};

/** The admin's part in a league where he has no other. */
export const adminWords = "Admin";

/** Why the commissioner's sign-in link didn't go, for each answer but "check your email". */
export const unsentLinkWords: Record<NoLinkReply, string> = {
  tryLater: "too many links were asked for that email in the last hour",
  paused: "today's emails have all been sent",
  notSent: "the email service didn't send it",
};

export const unsentLink = (email: string, reason: string) =>
  `No sign-in link went to ${email}: ${reason}. They can ask for one on the sign-in page.`;

export const maxTeamsHint = `${FEWEST_TEAMS} to ${MOST_TEAMS}. The commissioner can change it later, never below the teams already there.`;
export const commissionerHint = "If they have no account yet, they're sent a sign-in link.";

/** When creating failed before the server could say why: the connection, or the server itself. */
export const createFailedWords = "Something went wrong, so the league wasn't made. Check your connection and try again.";

// Deleting a league (#75, spec/13, Deleting).

export const deleteLeagueWords = "Delete league";
export const confirmDeleteWords = { yes: "Delete it", no: "Keep it" };
export const confirmDelete = (leagueName: string) =>
  `Delete ${leagueName}? At once it's frozen and hidden from everyone in it, and they're emailed. ` +
  `You can undo it for ${DELETION_UNDO_HOURS} hours; then it's gone for good, with its teams, Mail and history.`;

/** When it goes is said as the email says it (convex/londonTime.ts). */
export const beingDeleted = (deletesAt: number) =>
  `Being deleted: it goes for good on ${londonTime(deletesAt)}. Until then it's frozen and hidden from everyone in it.`;
export const undoWords = "Undo";
export const unemailed = (email: string, reason: string) => `${email} wasn't told: ${reason}.`;

/** When deleting a league, or undoing it, failed before the server could say why. */
export const deleteFailedWords = "Something went wrong, so the league wasn't deleted. Check your connection and try again.";
export const undoFailedWords = "Something went wrong, so the league is still being deleted. Check your connection and try again.";
