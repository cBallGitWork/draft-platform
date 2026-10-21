import type { Infer } from "convex/values";
import { londonTime } from "./londonTime";
import type { leagueEvent } from "./schema";

// What the letters Mail files about a league's events say (spec/15: nothing changes quietly), in
// one place for Craig to change. Each names who did it: an email, or `adminByline`.

export const adminByline = "The admin";

type LeagueEvent = Infer<typeof leagueEvent>;
type Words = { subject: string; body: string };

const handOn = "The team stays, for the commissioner to hand to someone new.";
const inPlaceOf = (replaced: string | null) => (replaced === null ? "" : ` in place of ${replaced}`);
const forTeam = (teamName: string | null) => (teamName === null ? "a new team" : teamName);

/** The letter reporting `event`, done by `who`. */
export function eventLetter(event: LeagueEvent, who: string): Words {
  switch (event.kind) {
    case "created":
      return { subject: `${event.name} was created`, body: `${who} created the league, for up to ${event.maxTeams} teams.` };
    case "commissionerNamed":
      return {
        subject: `${event.email} is the commissioner`,
        body: `${who} named ${event.email} the league's commissioner${inPlaceOf(event.replaced)}.`,
      };
    case "coCommissionerNamed":
      return {
        subject: `${event.email} is the co-commissioner`,
        body: `${who} named ${event.email} the league's co-commissioner${inPlaceOf(event.replaced)}.`,
      };
    case "coCommissionerRemoved":
      return { subject: `${event.email} is no longer co-commissioner`, body: `${who} removed ${event.email} as co-commissioner.` };
    case "managerAdded":
      return {
        subject: `${event.email} joined as manager of ${event.teamName}`,
        body: `${who} added ${event.email} as the manager of ${event.teamName}.`,
      };
    case "managerRemoved":
      return {
        subject: `${event.email} was removed from ${event.teamName}`,
        body: `${who} removed ${event.email} as the manager of ${event.teamName}. ${handOn}`,
      };
    case "managerLeft":
      return { subject: `${event.email} left ${event.teamName}`, body: `${event.email} left the league. ${handOn}` };
    case "teamRenamed":
      return { subject: `${event.from} is now ${event.to}`, body: `${who} renamed ${event.from} to ${event.to}.` };
    case "maxTeamsChanged":
      return {
        subject: `The league now holds up to ${event.to} teams`,
        body: `${who} changed the most teams the league holds from ${event.from} to ${event.to}.`,
      };
    case "deletionStarted":
      return {
        subject: `${event.name} is being deleted`,
        body: `${who} deleted the league. It goes for good on ${londonTime(event.deletesAt)}, unless that is undone.`,
      };
    case "deletionUndone":
      return { subject: `${event.name} is no longer being deleted`, body: `${who} undid deleting the league. It is as it was.` };
    case "gameweekUsed":
      return event.used
        ? { subject: `Gameweek ${event.gameweek} counts again`, body: `${who} made gameweek ${event.gameweek} count for the league again.` }
        : { subject: `Gameweek ${event.gameweek} won't count`, body: `${who} took gameweek ${event.gameweek} out of the league's season.` };
    case "invited":
      return { subject: `${event.email} was invited`, body: `${who} invited ${event.email} to manage ${forTeam(event.teamName)}.` };
    case "inviteResent":
      return { subject: `${event.email}'s invite was sent again`, body: `${who} sent ${event.email}'s invite to manage ${forTeam(event.teamName)} again.` };
    case "inviteCancelled":
      return { subject: `${event.email}'s invite was cancelled`, body: `${who} cancelled ${event.email}'s invite to manage ${forTeam(event.teamName)}.` };
    case "joinedByInvite":
      return {
        subject: `${event.email} joined as manager of ${event.teamName}`,
        body: `${event.email} took up ${event.invitedBy}'s invite and manages ${event.teamName}.`,
      };
    case "joinRequestApproved":
      return {
        subject: `${event.email} joined as manager of ${event.teamName}`,
        body: `${who} approved ${event.email}'s request to join. They manage ${event.teamName}.`,
      };
    case "inviteLinkMade":
      return {
        subject: "The league has a new invite link",
        body: `${who} made an invite link for the league${event.replacedOne ? ", and the old one no longer works" : ""}.`,
      };
    case "inviteLinkSwitchedOff":
      return { subject: "The invite link is off", body: `${who} switched the league's invite link off.` };
    case "rulesChanged":
      return {
        subject: `The league's rules change from gameweek ${event.fromGameweek}`,
        body: `${who} changed the league's ${event.changed.join(", ")}, from gameweek ${event.fromGameweek}.`,
      };
  }
}
