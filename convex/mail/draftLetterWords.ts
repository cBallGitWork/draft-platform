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
