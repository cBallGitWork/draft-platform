// What My team's Squad tab reads besides the squad and the lineup: the newest letters for its Mail
// widget. My team's seam holds it (../seam.ts); Convex fills it in live (../liveMyTeam.ts).

import type { LetterSummary } from "../../../convex/mail/mail";

export type LatestMail = { letters: readonly LetterSummary[]; unread: number; needsYou: readonly LetterSummary[] };

export type SquadSeam = {
  /** The signed-in person's newest letters, at most LATEST_LETTERS, how many of Mail's are unread,
   *  and those waiting on them (S16.3), live (a hook): undefined while they load, null for someone
   *  signed out. */
  useLatestMail(): LatestMail | null | undefined;
};
