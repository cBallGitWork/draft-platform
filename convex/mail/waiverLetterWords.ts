import type { LeagueEvent } from "../schema";
import { hoursWords } from "../shared/time";
import { WAIVER_MS } from "../waivers/waiverLimits";
import type { Words } from "./letterShape";

// What waivers' and free agency's Mail letters say (spec/08, spec/16): split from letterWords.ts,
// which writes the rest and calls these for a claim's and a pickup's letter.

/** How long until bids on a dropped player settle, as a letter says it: "at least 24 hours" (spec/08). */
export const onWaiversWords = `at least ${hoursWords(WAIVER_MS)}`;

/** A won bid as a headline: "Lions won the bid for Saka". */
export const wonBidWords = (teamName: string, playerName: string) => `${teamName} won the bid for ${playerName}`;

/** A commissioner's letting a player go to free agency: "ann@example.com took Saka off Lions. He's a
 *  free agent." */
export const letGoBody = (who: string, playerName: string, teamName: string) => `${who} took ${playerName} off ${teamName}. He's a free agent.`;

/** "ann@example.com won Saka for Lions with a bid and dropped Rice. He's released, and bids on
 *  him settle in at least 24 hours." */
export function claimedBody({ playerName, teamName, dropped }: Extract<LeagueEvent, { kind: "playerClaimed" }>, who: string): string {
  return withDropped(`${who} won ${playerName} for ${teamName} with a bid`, dropped);
}

/** "ann@example.com signed Saka for Lions as a free agent and dropped Rice. He's released, and
 *  bids on him settle in at least 24 hours." */
export function pickedUpBody({ playerName, teamName, dropped }: Extract<LeagueEvent, { kind: "playerPickedUp" }>, who: string): string {
  return withDropped(`${who} signed ${playerName} for ${teamName} as a free agent`, dropped);
}

/** `joined`, a sentence with no full stop, then who was dropped for him, if anyone, and where he goes. */
function withDropped(joined: string, dropped: Extract<LeagueEvent, { kind: "playerClaimed" | "playerPickedUp" }>["dropped"]): string {
  if (dropped === null) return `${joined}.`;
  return dropped.toWaivers
    ? `${joined} and dropped ${dropped.playerName}. He's released, and bids on him settle in ${onWaiversWords}.`
    : `${joined} and dropped ${dropped.playerName}. He was signed since the last deadline, so he's a free agent again.`;
}

/** Why a waiver claim failed (spec/08): another team was ahead, the player claimed has left the
 *  Premier League (#1327), the player he named to drop was already gone or held in a trade under
 *  review (#383), or the squad's limits. */
export const CLAIM_FAILURES = ["ahead", "playerGone", "dropGone", "dropHeld", "limits"] as const;
export type ClaimFailure = (typeof CLAIM_FAILURES)[number];

/** To a manager alone when his pending claim is withdrawn as the player he claimed leaves the
 *  Premier League (S08.24, #2200). */
export function claimWithdrawnLetter(playerName: string): Words {
  return {
    subject: `Your bid for ${playerName} is withdrawn`,
    body: `${playerName} has left the Premier League, so your bid for him is withdrawn. Your squad hasn't changed.`,
  };
}

/** To a manager alone when his claim fails at a waiver run (spec/08, spec/16), saying why. */
export function claimFailedLetter({ playerName, dropName, why }: { playerName: string; dropName: string | null; why: ClaimFailure }): Words {
  const because = {
    ahead: `Another team was ahead of you in the bid order for ${playerName}.`,
    playerGone: `${playerName} has left the Premier League, so he couldn't join your squad.`,
    dropGone: `${dropName ?? "The player you named to drop"} was no longer in your squad to drop.`,
    dropHeld: `${dropName ?? "The player you named to drop"} is in a trade under review, so he couldn't be dropped.`,
    limits: `Signing ${playerName} would have broken your squad limits.`,
  }[why];
  return { subject: `Your bid for ${playerName} failed`, body: `${because} The bid is off and your squad hasn't changed.` };
}
