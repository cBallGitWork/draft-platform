// The seam for Mail (#26): what the screens know of it and can ask of it. Convex fills it in live
// (liveMail.ts); the preview and the tests hand the screens their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { LetterSummary } from "../../convex/mail";
import type { Change } from "../refusal";

export type LeagueLetter = { leagueId: Id<"leagues">; subject: string; body: string };

export type Mail = {
  /** The signed-in person's letters, newest first, or null while they load. */
  letters: readonly LetterSummary[] | null;
  /** Marks a letter read. It never rejects: a failure is logged, and the letter stays unread. */
  open(letterId: Id<"letters">): Promise<void>;
  /** Sends the commissioner's letter to the whole league. */
  writeToLeague(letter: LeagueLetter): Change;
};
