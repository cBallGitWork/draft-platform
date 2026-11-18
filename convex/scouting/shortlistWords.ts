import { andListWords } from "../shared/moments";
import type { Words } from "../mail/letterShape";
import { letGoBody, onWaiversWords } from "../mail/waiverLetterWords";

// What the letters to a manager about a player on his shortlist say (spec/16, spec/19 The
// shortlist; #374), in one place for Craig to change: released, dropped, or clearing waivers; and
// its refusals.

export const shortlistRefusals = {
  playerGone: (name: string) => `${name} has left the Premier League, so he can't be shortlisted.`,
  /** With `most`, SHORTLIST_MOST (shortlist.ts), passed in so this file needn't import it back. */
  full: (most: number) => `A shortlist holds at most ${most} players. Take one off first.`,
};

/** To a manager whose shortlist holds a player just released to free agency, released by `who`. */
export function shortlistedReleasedLetter(playerName: string, teamName: string, who: string): Words {
  return {
    subject: `${playerName}, on your shortlist, is a free agent`,
    body: letGoBody(who, playerName, teamName),
  };
}

/** To a manager whose shortlist holds a player just dropped from `teamName` by `who`: onto
 *  waivers, or, under the churn rule (spec/08), back to the free agents. */
export function shortlistedDroppedLetter(
  { playerName, teamName, toWaivers }: { playerName: string; teamName: string; toWaivers: boolean },
  who: string,
): Words {
  const now = toWaivers ? `He's released, and bids on him settle in ${onWaiversWords}` : "He's a free agent again";
  return {
    subject: `${playerName}, on your shortlist, was dropped`,
    body: `${who} dropped ${playerName} from ${teamName}. ${now}.`,
  };
}

/** To a manager whose shortlist holds players nobody claimed at a waiver run, one letter a run
 *  naming them all: each is a free agent straight after (spec/08). */
export function shortlistedClearedLetter(playerNames: readonly string[]): Words {
  const one = playerNames.length === 1;
  return {
    subject: one ? `${playerNames[0]}, on your shortlist, is a free agent` : `${playerNames.length} players on your shortlist are free agents`,
    body: `Nobody bid for ${andListWords(playerNames)} when bids settled. ${one ? "He's a free agent" : "They're free agents"}, first come first served.`,
  };
}
