import type { Infer } from "convex/values";
import { aNewTeamWords } from "../joining/joiningShared";
import { LOCALE, londonTime } from "../shared/londonTime";
import type { LeagueRules } from "../rules/leagueRulesShape";
import { NOTHING_SCORES_DIFFERENTLY } from "../scoring/patchChanges";
import type { leagueEvent, siteScoringKind } from "../schema";

// What the letters Mail files about a league's events say (spec/15: nothing changes quietly), in
// one place for Craig to change. Each names who did it: an email, or `adminByline`.

export const adminByline = "The admin";

type LeagueEvent = Infer<typeof leagueEvent>;
type SiteScoringKind = Infer<typeof siteScoringKind>;
type Words = { subject: string; body: string };

const handOn = "The team stays, for the commissioner to hand to someone new.";
const inPlaceOf = (replaced: string | null) => (replaced === null ? "" : ` in place of ${replaced}`);
const forTeam = (teamName: string | null) => teamName ?? aNewTeamWords;

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
    case "playerAssigned":
      return { subject: `${event.playerName} joined ${event.teamName}`, body: `${who} put ${event.playerName} on ${event.teamName}.` };
    case "playerMoved":
      return {
        subject: `${event.playerName} moved to ${event.teamName}`,
        body: `${who} moved ${event.playerName} from ${event.fromTeamName} to ${event.teamName}.`,
      };
    case "playerReleased":
      return {
        subject: `${event.playerName} was released`,
        body: `${who} released ${event.playerName} from ${event.teamName} to free agency.`,
      };
    case "rulesChanged":
      return {
        subject: `The league's rules change from gameweek ${event.fromGameweek}`,
        body: rulesChangedBody(event, who),
      };
  }
}

/** Each part of a league's rules as a letter names it, and the scoring, which letters filed before
 *  it became the site's (#354) name. */
const RULES_PART_WORDS: Record<keyof LeagueRules | "scoring", string> = {
  format: "format",
  squad: "squad limits",
  areaLimits: "limits on the pitch",
  presets: "formations",
  deadline: "deadline",
  doubleGameweek: "double gameweek rule",
  tieBreaks: "tie-breaks",
  oddTeamOut: "odd team out",
  gamesPerGameweek: "games a gameweek",
  waivers: "waivers",
  scoring: "scoring",
};

const partWords = (part: string) => (Object.hasOwn(RULES_PART_WORDS, part) ? RULES_PART_WORDS[part as keyof typeof RULES_PART_WORDS] : part);

/** "a", "a and b", "a, b and c". */
const andList = new Intl.ListFormat(LOCALE, { type: "conjunction" });
const listWords = (items: readonly string[]) => andList.format(items);

/** "Ann changed the league's scoring and deadline, from gameweek 9. The scoring changed for Goals
 *  scored and Assists, and points are now whole only." */
function rulesChangedBody(event: Extract<LeagueEvent, { kind: "rulesChanged" }>, who: string): string {
  const changed = `${who} changed the league's ${listWords(event.changed.map(partWords))}, from gameweek ${event.fromGameweek}.`;
  const details = [
    ...(event.categories ? [`the scoring changed for ${listWords(event.categories)}`] : []),
    ...(event.wholePointsOnly === undefined ? [] : [event.wholePointsOnly ? "points are now whole only" : "points can now be fractions"]),
  ];
  return details.length === 0 ? changed : `${changed} ${capitalised(details.join(", and "))}.`;
}

const capitalised = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);

/** A new version of the site's scoring, as its letter to every manager reports it (spec/14, Changes
 *  and corrections; #356). */
type VersionNews = { name: string; kind: SiteScoringKind; takesEffectAt: number; fromGameweek: number; changes: readonly string[] };

/** The letter announcing a patch to the site's scoring, or a fix to it, with what changes. A fix
 *  takes effect as it is made, so its letter names no moment. */
export function versionLetter({ name, kind, takesEffectAt, fromGameweek, changes }: VersionNews): Words {
  const kept = "Gameweeks played before it keep the scoring they had.";
  const what = changes.length === 0 ? NOTHING_SCORES_DIFFERENTLY : `What changes:\n${changes.map((change) => `- ${change}`).join("\n")}`;
  if (kind === "patch") {
    return {
      subject: `Scoring patch ${name} takes effect on ${londonTime(takesEffectAt)}`,
      body:
        `${adminByline} announced patch ${name} to the scoring every league plays on. It takes effect on ` +
        `${londonTime(takesEffectAt)}, from gameweek ${fromGameweek}. ${kept}\n\n${what}`,
    };
  }
  return {
    subject: `Scoring fix ${name}`,
    body: `${adminByline} fixed a mistake in the scoring every league plays on: version ${name}, in force from gameweek ${fromGameweek}. ${kept}\n\n${what}`,
  };
}
