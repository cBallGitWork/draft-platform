import { aNewTeamWords } from "../joining/joiningShared";
import { andListWords, capitalised } from "../shared/moments";
import type { LeagueRules } from "../rules/leagueRulesShape";
import { autoTeamSwitchedWords } from "../lineup/autoTeamWords";
import type { LeagueEvent } from "../schema";
import { overrideLetterWords } from "./overrideLetterWords";
import { claimedBody, onWaiversWords, pickedUpBody } from "./waiverLetterWords";
import type { TellMoment } from "./letterMoments";
import type { Words } from "./letterShape";

// What the letters Mail files about a league's events say (spec/15: nothing changes quietly), in
// one place for Craig to change. Each names who did it: an email, or `adminByline`. The draft's
// letters are in draftLetterWords.ts, and the site scoring's in scoringLetterWords.ts.

export const adminByline = "The admin";

const handOn = "The team stays, for the commissioner to hand to someone new.";
const inPlaceOf = (replaced: string | null) => (replaced === null ? "" : ` in place of ${replaced}`);
const forTeam = (teamName: string | null) => teamName ?? aNewTeamWords;
const joinedSubject = ({ email, teamName }: { email: string; teamName: string }) => `${email} joined as manager of ${teamName}`;

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
      return { subject: joinedSubject(event), body: `${who} added ${event.email} as the manager of ${event.teamName}.` };
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
      return { subject: joinedSubject(event), body: `${event.email} took up ${event.invitedBy}'s invite and manages ${event.teamName}.` };
    case "joinRequestApproved":
      return { subject: joinedSubject(event), body: `${who} approved ${event.email}'s request to join. They manage ${event.teamName}.` };
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
