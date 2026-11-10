import { andListWords } from "../shared/moments";
import type { Words } from "../mail/letterShape";
import { onWaiversWords } from "../mail/waiverLetterWords";

// What the letters to a manager about a player on his shortlist say (spec/16, spec/19 The
// shortlist; #374), in one place for Craig to change: released, dropped, or clearing waivers.

/** To a manager whose shortlist holds a player just released to free agency, released by `who`. */
export function shortlistedReleasedLetter(playerName: string, teamName: string, who: string): Words {
  return {
    subject: `${playerName}, on your shortlist, was released`,
    body: `${who} released ${playerName} from ${teamName}. He is a free agent, and on your shortlist.`,
  };
}

/** To a manager whose shortlist holds a player just dropped from `teamName` by `who`: onto
 *  waivers, or, under the churn rule (spec/08), back to the free agents. */
export function shortlistedDroppedLetter(
  { playerName, teamName, toWaivers }: { playerName: string; teamName: string; toWaivers: boolean },
  who: string,
): Words {
  const now = toWaivers ? `He is on waivers for ${onWaiversWords}` :"He is a free agent again, not on waivers";
  return {
    subject: `${playerName}, on your shortlist, was dropped`,
    body: `${who} dropped ${playerName} from ${teamName}. ${now}, and on your shortlist.`,
  };
}

/** To a manager whose shortlist holds players nobody claimed at a waiver run, one letter a run
 *  naming them all: each is a free agent straight after (spec/08). */
export function shortlistedClearedLetter(playerNames: readonly string[]): Words {
  const one = playerNames.length === 1;
  return {
    subject: one ? `${playerNames[0]}, on your shortlist, cleared waivers` : `${playerNames.length} players on your shortlist cleared waivers`,
    body: `Nobody claimed ${andListWords(playerNames)} at the waiver run. ${one ? "He is a free agent" : "They are free agents"}, first come first served, and on your shortlist.`,
  };
}
