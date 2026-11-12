import type { Words } from "../mail/letterShape";
import type { LeagueEvent } from "../schema";

// What the auto team's refusals and letters say (spec/09, The auto team; #1207), in one place for
// Craig to change. Mail's letterWords.ts reads the switch's letter from here.

type Switched = Extract<LeagueEvent,{ kind: "autoTeamSwitched" }>;

/** Why a switch was refused, as the caller is told it. */
export const autoTeamRefusals = {
  notYours: "Only the team's manager, the league's commissioner, its co-commissioner or the admin can switch its auto team.",
  alreadyOn: "That team is already on the auto team.",
  alreadyOff: "That team isn't on the auto team.",
  noManager: "A team with no manager is on the auto team until it is handed on.",
  endsAfterOnlyManager: "Only the team's own manager can name a gameweek its auto team ends after.",
  noGameweekToEnd: "There is no gameweek left to come for the auto team to end after.",
  endsAfterOutOfRange: (first: number, last: number) => `Name a gameweek your league plays, from ${first} to ${last}, for the auto team to end after.`,
} as const;

/** What the auto team does, as its letters say. */
const autoTeamDoes =
  "At each deadline it keeps the last lineup and brings on the first bench player who fits for any starter who is out; it never drops or adds a player.";

/** The letter for a person switching the auto team on or off, done by `who`. */
export function autoTeamSwitchedWords(event: Switched, who: string): Words {
  if (!event.on) return { subject: `${event.teamName} is off the auto team`, body: `${who} switched the auto team off for ${event.teamName}.` };
  const until = event.endsAfter === null ? "" : ` until after gameweek ${event.endsAfter}`;
  return {
    subject: `${event.teamName} is on the auto team`,
    body: `${who} switched the auto team on for ${event.teamName}${until}. ${autoTeamDoes}`,
  };
}

/** The letters the app files about the auto team at a deadline, with no one's name on them. */
export const autoTeamLetters = {
  /** Its lineup couldn't stand, so the auto team set it for this gameweek alone. */
  fixed: (teamName: string, gameweek: number): Words => ({
    subject: `The auto team set ${teamName}'s lineup for gameweek ${gameweek}`,
    body: `${teamName}'s lineup couldn't stand at gameweek ${gameweek}'s deadline, so the auto team switched on and set it for that gameweek alone. It is off again from gameweek ${gameweek + 1}.`,
  }),
  /** The gameweek its manager named has begun, so it is off from the next. */
  ended: (teamName: string, gameweek: number): Words => ({
    subject: `${teamName} is off the auto team`,
    body: `The auto team ran ${teamName} until after gameweek ${gameweek}, as its manager asked, and is off from gameweek ${gameweek + 1}.`,
  }),
};
