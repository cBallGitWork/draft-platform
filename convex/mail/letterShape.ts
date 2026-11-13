// A letter's shape: its words, the shape every *Words.ts file returns, and its kind. Its own
// module, so those files and letterWords.ts, which imports several of them, share it without
// importing one another, and convex/schema/mail.ts builds its validator from it.

import { v } from "convex/values";

/** What a letter is about, which its chip on Mail names (approved/mail): one for each kind of
 *  letter Mail files (spec/16, S16.5), its words in src/mail/words.ts (`letterKindWords`). */
export const LETTER_KINDS = ["trade", "waivers", "assigned", "commissioner", "league", "draft", "lineup", "positions", "scout", "recap", "patch"] as const;
export type LetterKind = (typeof LETTER_KINDS)[number];
export const letterKind = v.union(...LETTER_KINDS.map((kind) => v.literal(kind)));

/** A letter's subject and body. */
export type Words = { subject: string; body: string };
