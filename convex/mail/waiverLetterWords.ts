import type { LeagueEvent } from "../schema";
import { hoursWords } from "../shared/time";
import { WAIVER_MS } from "../waivers/waiverLimits";
import type { Words } from "./letterShape";

// What waivers' and free agency's Mail letters say (spec/08, spec/16): split from letterWords.ts,
// which writes the rest and calls these for a claim's and a pickup's letter.

/** How long a dropped player is on waivers, as a letter says it: "at least 24 hours" (spec/08). */
export const onWaiversWords = `at least ${hoursWords(WAIVER_MS)}`;

/** "Lions claimed Saka off waivers, ann@example.com's claim. Rice went for him, onto waivers for
 *  at least 24 hours." */
export function claimedBody({ playerName, teamName, dropped }: Extract<LeagueEvent, { kind: "playerClaimed" }>, who: string): string {
  return withDropped(`${teamName} claimed ${playerName} off waivers, ${who}'s claim.`, dropped);
}

/** "ann@example.com picked up Saka for Lions as a free agent. Rice went for him, onto waivers for
 *  at least 24 hours." */
export function pickedUpBody({ playerName, teamName, dropped }: Extract<LeagueEvent, { kind: "playerPickedUp" }>, who: string): string {
  return withDropped(`${who} picked up ${playerName} for ${teamName} as a free agent.`, dropped);
}

/** `joined`, then who went for him, if anyone, and where. */
function withDropped(joined: string, dropped: Extract<LeagueEvent, { kind: "playerClaimed" | "playerPickedUp" }>["dropped"]): string {
  if (dropped === null) return joined;
  const where = dropped.toWaivers
    ? `onto waivers for ${onWaiversWords}`
    : "a free agent again, not on waivers: he was picked up since the last deadline";
  return `${joined} ${dropped.playerName} went for him, ${where}.`;
}

/** Why a waiver claim failed (spec/08): another team was ahead, the player claimed has left the
 *  Premier League (#1327), the player he named to drop was already gone or held in a trade under
 *  review (#383), or the squad's limits. */
export const CLAIM_FAILURES = ["ahead", "playerGone", "dropGone", "dropHeld", "limits"] as const;
export type ClaimFailure = (typeof CLAIM_FAILURES)[number];

/** To a manager alone when his claim fails at a waiver run (spec/08, spec/16), saying why. */
export function claimFailedLetter({ playerName, dropName, why }: { playerName: string; dropName: string | null; why: ClaimFailure }): Words {
  const because = {
    ahead: `Another team was ahead of you in the waiver order for ${playerName}.`,
    playerGone: `${playerName} has left the Premier League, so he couldn't join your squad.`,
    dropGone: `${dropName ?? "The player you named to drop"} was no longer in your squad to drop.`,
    dropHeld: `${dropName ?? "The player you named to drop"} is in a trade under review, so he couldn't be dropped.`,
    limits: `${playerName} would have broken your squad's limits.`,
  }[why];
  return { subject: `Your claim for ${playerName} failed`, body: `${because} Your claim is gone; nobody joined or left your squad for it.` };
}
