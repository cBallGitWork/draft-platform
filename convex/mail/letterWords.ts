import type { Infer } from "convex/values";
import { aNewTeamWords } from "../joining/joiningShared";
import { andListWords, momentIn } from "../shared/moments";
import { figureWords } from "../shared/numberWords";
import type { LeagueRules } from "../rules/leagueRulesShape";
import { NOTHING_SCORES_DIFFERENTLY } from "../scoring/patchChanges";
import type { leagueEvent, siteScoringKind } from "../schema";
import { claimedBody, pickedUpBody } from "./waiverLetterWords";

// What the letters Mail files about a league's events say (spec/15: nothing changes quietly), in
// one place for Craig to change. Each names who did it: an email, or `adminByline`.

export const adminByline = "The admin";

type LeagueEvent = Infer<typeof leagueEvent>;
type SiteScoringKind = Infer<typeof siteScoringKind>;
type Words = { subject: string; body: string };

const handOn = "The team stays, for the commissioner to hand to someone new.";
const inPlaceOf = (replaced: string | null) => (replaced === null ? "" : ` in place of ${replaced}`);
const forTeam = (teamName: string | null) => teamName ?? aNewTeamWords;

/** The letter reporting `event`, done by `who`, telling any time in `zone`, the reader's. */
export function eventLetter(event: LeagueEvent, who: string, zone: string | undefined): Words {
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
        body: `${who} deleted the league. It goes for good on ${momentIn(event.deletesAt, zone)}, unless that is undone.`,
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
    case "playerDropped":
      return {
        subject: `${event.teamName} dropped ${event.playerName}`,
        body: event.toWaivers
          ? `${who} dropped ${event.playerName} from ${event.teamName}. He is on waivers for at least 24 hours.`
          : `${who} dropped ${event.playerName} from ${event.teamName}. Picked up since the last deadline, he is a free agent again, not on waivers.`,
      };
    case "playerClaimed":
      return { subject: `${event.teamName} claimed ${event.playerName}`, body: claimedBody(event, who) };
    case "playerPickedUp":
      return { subject: `${event.teamName} picked up ${event.playerName}`, body: pickedUpBody(event, who) };
    case "rulesChanged":
      return {
        subject: `The league's rules change from gameweek ${event.fromGameweek}`,
        body: rulesChangedBody(event, who),
      };
    case "pointsOverridden":
      return { subject: `${event.playerName}'s points in ${event.matchName} were overridden`, body: overriddenBody(event, who) };
    case "fixturesSwapped":
      return { subject: `Gameweek ${event.gameweek}'s fixtures were changed`, body: swappedBody(event, who) };
  }
}

/** The league's average, as a letter about the fixtures names it. */
export const leagueAverageWords = "the league's average";
const sideWords = (name: string | null) => name ?? leagueAverageWords;

/** "Ann swapped Lions and Tigers in gameweek 6. The two games are now Tigers v Wolves and Lions v
 *  Bears; every other game is as drawn." */
function swappedBody(event: Extract<LeagueEvent, { kind: "fixturesSwapped" }>, who: string): string {
  const [one, other] = event.swapped.map(sideWords);
  const games = event.games.map((game) => matchWords(sideWords(game.team), sideWords(game.opponent)));
  return `${who} swapped ${one} and ${other} in gameweek ${event.gameweek}. The two games are now ${andListWords(games)}; every other game is as drawn.`;
}

/** A match as a letter names it: "Arsenal v Chelsea". */
export const matchWords = (home: string, away: string) => `${home} v ${away}`;

/** "Ann overrode Saka's points in Arsenal v Chelsea, gameweek 6: 2 to 8. Why: a goal the feed
 *  gave to Rice. / Lions now have 61 in gameweek 6, not 55." */
function overriddenBody(event: Extract<LeagueEvent, { kind: "pointsOverridden" }>, who: string): string {
  const { playerName, matchName, gameweek, from, to, reason, teams } = event;
  const change = from === null ? `now ${figureWords(to)}` : `${figureWords(from)} to ${figureWords(to)}`;
  const totals =
    teams.length === 0
      ? "No team's total moved: no lineup counted him."
      : teams.map((team) => `${team.teamName} now have ${figureWords(team.to)} in gameweek ${gameweek}, not ${figureWords(team.from)}.`).join("\n");
  return `${who} overrode ${playerName}'s points in ${matchName}, gameweek ${gameweek}: ${change}. Why: ${reason}\n\n${totals}`;
}

/** The letter to a manager whose shortlist holds a player just released to free agency (spec/16,
 *  spec/19 The shortlist), released by `who`. */
export function shortlistedReleasedLetter(playerName: string, teamName: string, who: string): Words {
  return {
    subject: `${playerName}, on your shortlist, was released`,
    body: `${who} released ${playerName} from ${teamName}. He is a free agent, and on your shortlist.`,
  };
}

/** The draft's letters (spec/04, Mail; #1102). "You're up next" to the manager whose pick's clock
 *  starts, its deadline told in `zone`, the reader's; it is also the email when the clock is long. */
export function upNextLetter({ round, pick, teamName, endsAt }: { round: number; pick: number; teamName: string; endsAt: number }, zone: string | undefined): Words {
  return {
    subject: "You're up next in the draft",
    body: `${teamName} is on the clock: round ${round}, pick ${pick}. Make your pick by ${momentIn(endsAt, zone)}, or the draft picks for you.`,
  };
}

/** To the whole league once the last pick is made. */
export function draftOverLetter(picks: number): Words {
  return { subject: "The draft is over", body: `All ${picks} picks are made, and every squad is drafted.` };
}

/** To the commissioner when the draft ends after the deadline of the gameweek scoring was to start
 *  in, `from`, so it starts in `to` (spec/04, After the draft; #1097). */
export function scoringStartMovedLetter({ from, to }: { from: number; to: number }): Words {
  return {
    subject: `Scoring starts in gameweek ${to}`,
    body: `The draft ended after gameweek ${from}'s deadline, so scoring starts in gameweek ${to}, not ${from}. Squads and lineups count from gameweek ${to}'s deadline.`,
  };
}

/** To the whole league when the commissioner, `who`, pauses the draft. Resuming files none. */
export function draftPausedLetter(who: string): Words {
  return { subject: "The draft is paused", body: `${who} paused the draft. No pick is made until it resumes.` };
}

/** A pick as the commissioner's letters name it: its number, the player and his team. */
export type PickNews = { pick: number; playerName: string; teamName: string };

/** To the whole league when the commissioner, `who`, makes a team's pick for it (#1095). */
export function draftPickedForLetter(who: string, { pick, playerName, teamName }: PickNews): Words {
  return { subject: `${playerName} was picked for ${teamName}`, body: `${who} made pick ${pick} for ${teamName}: ${playerName}.` };
}

/** To the whole league when the commissioner, `who`, undoes a pick (#1095). */
export function draftUndoneLetter(who: string, { pick, playerName, teamName }: PickNews): Words {
  return {
    subject: `Pick ${pick} was undone`,
    body: `${who} undid pick ${pick}, ${playerName} to ${teamName}. ${playerName} can be picked again, and ${teamName} is back on the clock.`,
  };
}

/** To the commissioner when the draft's start date, `startsAt`, comes and it can't start, for
 *  `refusal` (draftStart.ts `draftStartRefusals`). */
export function draftNotStartedLetter(startsAt: number, refusal: string, zone: string | undefined): Words {
  return {
    subject: "The draft didn't start",
    body: `The draft was set to start on ${momentIn(startsAt, zone)}, but couldn't. ${refusal} It waits for you to press start or set a new date.`,
  };
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
  draft: "draft settings",
  scoring: "scoring",
};

const partWords = (part: string) => (Object.hasOwn(RULES_PART_WORDS, part) ? RULES_PART_WORDS[part as keyof typeof RULES_PART_WORDS] : part);


/** "Ann changed the league's scoring and deadline, from gameweek 9. The scoring changed for Goals
 *  scored and Assists, and points are now whole only." */
function rulesChangedBody(event: Extract<LeagueEvent, { kind: "rulesChanged" }>, who: string): string {
  const changed = `${who} changed the league's ${andListWords(event.changed.map(partWords))}, from gameweek ${event.fromGameweek}.`;
  const details = [
    ...(event.categories ? [`the scoring changed for ${andListWords(event.categories)}`] : []),
    ...(event.wholePointsOnly === undefined ? [] : [event.wholePointsOnly ? "points are now whole only" : "points can now be fractions"]),
  ];
  return details.length === 0 ? changed : `${changed} ${capitalised(details.join(", and "))}.`;
}

const capitalised = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);

/** A new version of the site's scoring, as its letter to every manager reports it (spec/14, Changes
 *  and corrections; #356). */
type VersionNews = { name: string; kind: SiteScoringKind; takesEffectAt: number; fromGameweek: number; changes: readonly string[] };

/** The letter announcing a patch to the site's scoring, or a fix to it, with what changes. A fix
 *  takes effect as it is made, so its letter names no moment; a patch's is told in `zone`, the reader's. */
export function versionLetter({ name, kind, takesEffectAt, fromGameweek, changes }: VersionNews, zone: string | undefined): Words {
  const kept = "Gameweeks played before it keep the scoring they had.";
  const what = changes.length === 0 ? NOTHING_SCORES_DIFFERENTLY : `What changes:\n${changes.map((change) => `- ${change}`).join("\n")}`;
  if (kind === "patch") {
    return {
      subject: `Scoring patch ${name} takes effect on ${momentIn(takesEffectAt, zone)}`,
      body:
        `${adminByline} announced patch ${name} to the scoring every league plays on. It takes effect on ` +
        `${momentIn(takesEffectAt, zone)}, from gameweek ${fromGameweek}. ${kept}\n\n${what}`,
    };
  }
  return {
    subject: `Scoring fix ${name}`,
    body: `${adminByline} fixed a mistake in the scoring every league plays on: version ${name}, in force from gameweek ${fromGameweek}. ${kept}\n\n${what}`,
  };
}
