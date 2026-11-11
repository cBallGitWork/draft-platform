import type { Infer } from "convex/values";
import { aNewTeamWords } from "../joining/joiningShared";
import { andListWords } from "../shared/moments";
import type { LeagueRules } from "../rules/leagueRulesShape";
import { NOTHING_SCORES_DIFFERENTLY } from "../scoring/patchChanges";
import { autoTeamSwitchedWords } from "../lineup/autoTeamWords";
import type { leagueEvent, siteScoringKind } from "../schema";
import { overrideLetterWords } from "./overrideLetterWords";
import { claimedBody, onWaiversWords, pickedUpBody } from "./waiverLetterWords";
import type { TellMoment } from "./letterMoments";
import type { Words } from "./letterShape";

// What the letters Mail files about a league's events say (spec/15: nothing changes quietly), in
// one place for Craig to change. Each names who did it: an email, or `adminByline`.

export const adminByline = "The admin";

type LeagueEvent = Infer<typeof leagueEvent>;
type SiteScoringKind = Infer<typeof siteScoringKind>;

const handOn = "The team stays, for the commissioner to hand to someone new.";
const inPlaceOf = (replaced: string | null) => (replaced === null ? "" : ` in place of ${replaced}`);
const forTeam = (teamName: string | null) => teamName ?? aNewTeamWords;

/** The letter reporting `event`, done by `who`, telling any time with `tell`, in the reader's zone. */
export function eventLetter(event: LeagueEvent, who: string, tell: TellMoment): Words {
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
        body: `${who} deleted the league. It goes for good on ${tell(event.deletesAt)}, unless that is undone.`,
      };
    case "deletionUndone":
      return { subject: `${event.name} is no longer being deleted`, body: `${who} undid deleting the league. It is as it was.` };
    case "gameweekUsed":
      return event.used
        ? { subject: `Gameweek ${event.gameweek} counts again`, body: `${who} made gameweek ${event.gameweek} count for the league again.` }
        : {
            subject: `Gameweek ${event.gameweek} won't count`,
            body: `${who} took gameweek ${event.gameweek} out of the league's season.${event.startMovedTo === undefined ? "" : ` ${startsInWords(event.startMovedTo, event.gameweek)}`}`,
          };
    case "scoringStartSet":
      return {
        subject: `Scoring starts in gameweek ${event.to}`,
        body: `${who} set the gameweek the league's scoring starts in. ${startsInWords(event.to, event.from)}`,
      };
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
          ? `${who} dropped ${event.playerName} from ${event.teamName}. He is on waivers for ${onWaiversWords}.`
          : `${who} dropped ${event.playerName} from ${event.teamName}. Picked up since the last deadline, he is a free agent again, not on waivers.`,
      };
    case "playerClaimed":
      return { subject: `${event.teamName} claimed ${event.playerName}`, body: claimedBody(event, who) };
    case "playerPickedUp":
      return { subject: `${event.teamName} picked up ${event.playerName}`, body: pickedUpBody(event, who) };
    case "playerTraded":
    case "tradeMade":
      // A trade's letters are its own (tradeLetterWords.ts), so its events are filed with none.
      throw new Error(`A ${event.kind} event files no letter: the trade letter says it`);
    case "rulesChanged":
      return {
        subject: `The league's rules change from gameweek ${event.fromGameweek}`,
        body: rulesChangedBody(event, who),
      };
    case "pointsOverridden":
    case "pointsOverrideRemoved":
    case "teamPointsOverridden":
      return overrideLetterWords(event, who);
    case "fixturesSwapped":
      return { subject: `Gameweek ${event.gameweek}'s fixtures were changed`, body: swappedBody(event, who) };
    case "autoTeamSwitched":
      return autoTeamSwitchedWords(event, who);
  }
}

/** What a scoring start set or moved means for the league: scoring starts in `to`, not `from` (null
 *  while none was set, when every ticked gameweek scored), and the gameweeks before it score nothing. */
function startsInWords(to: number, from: number | null): string {
  const instead = from === null ? "" : `, not ${from}`;
  return `Scoring starts in gameweek ${to}${instead}: squads and lineups count from its deadline, and the gameweeks before it score nothing.`;
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

/** The subject of the draft's "You're up next" letter. */
export const UP_NEXT_SUBJECT = "You're up next in the draft";

/** The subject of the draft's letter once it is over. */
export const DRAFT_OVER_SUBJECT = "The draft is over";

/** The draft's letters (spec/04, Mail; #1102). "You're up next" to the manager whose pick's clock
 *  starts, its deadline told with `tell`, in the reader's zone; it is also the email when the clock is
 *  long. `endsAt` is null while the draft is paused: his clock starts when it resumes (#1461). */
export function upNextLetter({ round, pick, teamName, endsAt }: { round: number; pick: number; teamName: string; endsAt: number | null }, tell: TellMoment): Words {
  const subject = UP_NEXT_SUBJECT;
  if (endsAt === null) {
    return { subject, body: `${teamName} is up next: round ${round}, pick ${pick}. The draft is paused; your clock starts when it resumes.` };
  }
  return { subject, body: `${teamName} is on the clock: round ${round}, pick ${pick}. Make your pick by ${tell(endsAt)}, or the draft picks for you.` };
}

/** To the whole league once the last pick is made. */
export function draftOverLetter(picks: number): Words {
  return { subject: DRAFT_OVER_SUBJECT, body: `All ${picks} picks are made, and every squad is drafted.` };
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
export function draftNotStartedLetter(startsAt: number, refusal: string, tell: TellMoment): Words {
  return {
    subject: "The draft didn't start",
    body: `The draft was set to start on ${tell(startsAt)}, but couldn't. ${refusal} It waits for you to press start or set a new date.`,
  };
}

/** Each part of a league's rules as a letter names it, and the scoring, which letters filed before
 *  it became the site's (#354) name. */
const RULES_PART_WORDS: Record<keyof LeagueRules | "scoring", string> = {
  format: "format",
  squad: "squad limits",
  areaLimits: "limits on the pitch",
  presets: "formations",
  classics: "classic formations",
  deadline: "deadline",
  doubleGameweek: "double gameweek rule",
  tieBreaks: "tie-breaks",
  oddTeamOut: "odd team out",
  gamesPerGameweek: "games a gameweek",
  waivers: "waivers",
  draft: "draft settings",
  trades: "trade settings",
  instructions: "team instructions",
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
 *  takes effect as it is made, so its letter names no moment; a patch's is told with `tell`, in the reader's zone. */
export function versionLetter({ name, kind, takesEffectAt, fromGameweek, changes }: VersionNews, tell: TellMoment): Words {
  const kept = "Gameweeks played before it keep the scoring they had.";
  const what = changes.length === 0 ? NOTHING_SCORES_DIFFERENTLY : `What changes:\n${changes.map((change) => `- ${change}`).join("\n")}`;
  if (kind === "patch") {
    return {
      subject: `Scoring patch ${name} takes effect on ${tell(takesEffectAt)}`,
      body:
        `${adminByline} announced patch ${name} to the scoring every league plays on. It takes effect on ` +
        `${tell(takesEffectAt)}, from gameweek ${fromGameweek}. ${kept}\n\n${what}`,
    };
  }
  return {
    subject: `Scoring fix ${name}`,
    body: `${adminByline} fixed a mistake in the scoring every league plays on: version ${name}, in force from gameweek ${fromGameweek}. ${kept}\n\n${what}`,
  };
}

/** The letter saying a patch to the site's scoring was withdrawn before it took effect (Craig, 6 Nov
 *  2026, on #368: "every manager gets a Mail letter saying so"), its moment told with `tell`. */
export function withdrawnLetter({ name, takesEffectAt }: { name: string; takesEffectAt: number }, tell: TellMoment): Words {
  return {
    subject: `Scoring patch ${name} withdrawn`,
    body: `${adminByline} withdrew patch ${name}, which was to take effect on ${tell(takesEffectAt)}. The scoring stays as it is.`,
  };
}
