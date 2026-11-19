import type { Words } from "../mail/letterShape";
import type { LeagueEvent } from "../schema";

// What the auto team's refusals and letters say (spec/09, The auto team; #1207), in one place for
// Craig to change. On screen it is "Away mode" (Glossary, Craig, 18 Nov 2026). Mail's letterWords.ts reads the switch's letter from here.

type Switched = Extract<LeagueEvent,{ kind: "autoTeamSwitched" }>;

/** Why a switch was refused, as the caller is told it. */
export const autoTeamRefusals = {
  notYours: "Only the team's manager, the league's commissioner, its co-commissioner or the admin can switch its Away mode.",
  alreadyOn: "That team is already in Away mode.",
  alreadyOff: "That team isn't in Away mode.",
  noManager: "A team with no manager stays in Away mode until it has a new one.",
  endsAfterOnlyManager: "Only the team's manager can choose when its Away mode ends.",
  noGameweekToEnd: "No gameweeks are left to choose.",
  endsAfterOutOfRange: (first: number, last: number) => `Choose a gameweek from ${first} to ${last}. Away mode ends after it.`,
} as const;

/** What Away mode does, as its letters say. */
const autoTeamDoes =
  "At each deadline it keeps the last line-up and swaps anyone in your XI who is out for the first bench player who fits. It never signs or drops a player.";

/** The letter for a person switching Away mode on or off, done by `who`. */
export function autoTeamSwitchedWords(event: Switched, who: string): Words {
  if (!event.on) return { subject: `${event.teamName} is out of Away mode`, body: `${who} switched Away mode off for ${event.teamName}.` };
  const until = event.endsAfter === null ? "" : ` until after gameweek ${event.endsAfter}`;
  return {
    subject: `${event.teamName} is in Away mode`,
    body: `${who} switched Away mode on for ${event.teamName}${until}. ${autoTeamDoes}`,
  };
}

/** The letters the app files about the auto team at a deadline, with no one's name on them. */
export const autoTeamLetters = {
  /** Its lineup couldn't stand, so the auto team set it for this gameweek alone. */
  fixed: (teamName: string, gameweek: number): Words => ({
    subject: `Away mode set ${teamName}'s line-up for gameweek ${gameweek}`,
    body: `${teamName}'s line-up broke the league's rules at the gameweek ${gameweek} deadline, so Away mode set it for that gameweek only. It's off again from gameweek ${gameweek + 1}.`,
  }),
  /** The gameweek its manager named has begun, so it is off from the next. */
  ended: (teamName: string, gameweek: number): Words => ({
    subject: `${teamName} is out of Away mode`,
    body: `Away mode ran ${teamName} to the end of gameweek ${gameweek}, as its manager asked. It's off from gameweek ${gameweek + 1}.`,
  }),
};
