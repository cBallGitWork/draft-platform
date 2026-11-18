import type { TellMoment } from "./letterMoments";
import type { Words } from "./letterShape";

// What the draft's Mail letters say (spec/04, Mail; #1102): split from letterWords.ts, as waivers'
// and trades' are. ../draft/draftLetters.ts files them.

/** The subject of the draft's "You're up next" letter. */
export const UP_NEXT_SUBJECT = "You're up next in the draft";

/** The subject of the draft's letter once it is over. */
export const DRAFT_OVER_SUBJECT = "The draft is over";

/** "You're up next" to the manager whose pick's clock starts, its deadline told with `tell`, in the
 *  reader's zone; it is also the email when the clock is long. `endsAt` is null while the draft is
 *  paused: his clock starts when it resumes (#1461). */
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
    body: `The draft finished after gameweek ${from}'s deadline, so scoring starts in gameweek ${to} instead. Squads and line-ups count from its deadline.`,
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
  return { subject: `${playerName} was picked for ${teamName}`, body: `${who} picked ${playerName} for ${teamName} at pick ${pick}.` };
}

/** To the whole league when the commissioner, `who`, undoes a pick (#1095). */
export function draftUndoneLetter(who: string, { pick, playerName, teamName }: PickNews): Words {
  return {
    subject: `Pick ${pick} was undone`,
    body: `${who} undid pick ${pick}, ${playerName} to ${teamName}. ${playerName} can be picked again and ${teamName} is back on the clock.`,
  };
}

/** To the whole league when the commissioner, `who`, puts the teams in draft order, or draws it at
 *  random when `drawn`: the order, first pick first (S04.31; #2149). */
export function draftOrderLetter(who: string, teamNames: readonly string[], drawn: boolean): Words {
  const how = drawn ? "drew the draft order at random" : "set the draft order";
  return { subject: "The draft order is set", body: `${who} ${how}: ${teamNames.map((name, at) => `${at + 1}. ${name}`).join(", ")}.` };
}

/** To the whole league when the commissioner, `who`, sets the draft's start, told with `tell`, or
 *  clears it with null, so the draft waits for him to press start (S04.31; #2149). */
export function draftStartDateLetter(who: string, startsAt: number | null, tell: TellMoment): Words {
  if (startsAt === null) return { subject: "The draft has no start date", body: `${who} cleared the draft's start date. The draft starts when the commissioner presses start.` };
  return { subject: `The draft starts on ${tell(startsAt)}`, body: `${who} set the draft to start on ${tell(startsAt)}.` };
}

/** To the whole league when the commissioner, `who`, marks a team with no manager "I'll pick for
 *  this one", or unmarks it, so the draft picks for it (S04.31; #2149). */
export function draftPickerLetter(who: string, teamName: string, marked: boolean): Words {
  if (marked) return { subject: `The commissioner picks for ${teamName}`, body: `${who} will make ${teamName}'s picks in the draft.` };
  return { subject: `The draft picks for ${teamName}`, body: `${who} no longer picks for ${teamName}. Auto-pick makes its picks now.` };
}

/** To the commissioner when the draft's start date, `startsAt`, comes and it can't start, for
 *  `refusal` (draftStart.ts `draftStartRefusals`). */
export function draftNotStartedLetter(startsAt: number, refusal: string, tell: TellMoment): Words {
  return {
    subject: "The draft didn't start",
    body: `The draft was due to start on ${tell(startsAt)} but couldn't. ${refusal} Press start or set a new date.`,
  };
}
