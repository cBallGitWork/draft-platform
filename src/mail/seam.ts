// The seam for Mail (#26): what the screens know of it and can ask of it. Convex fills it in live
// (liveMail.ts); the preview and the tests hand the screens their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { LetterSummary } from "../../convex/mail/mail";
import type { Change } from "../refusal";

export type LeagueLetter = { leagueId: Id<"leagues">; subject: string; body: string };

export type MailSeam = {
  /** The signed-in person's letters, newest first, live (a hook): undefined while they load. Only
   *  Mail calls it, so no other screen holds the letters' query open: each letter filed re-sends
   *  them all (#211). */
  useLetters(): readonly LetterSummary[] | undefined;
  /** Marks a letter read. It never rejects: a failure is logged, and the letter stays unread. */
  open(letterId: Id<"letters">): Promise<void>;
  /** Sends the commissioner's letter to the whole league. */
  writeToLeague(letter: LeagueLetter): Change;
};
