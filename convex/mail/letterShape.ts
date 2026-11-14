// A letter's shape: its words, the shape every *Words.ts file returns, and its kind. Its own
// module, so those files and letterWords.ts, which imports several of them, share it without
// importing one another, and convex/schema/mail.ts builds its validator from it.

import { v, type Infer } from "convex/values";

/** What a letter is about, which its chip on Mail names (approved/mail): one for each kind of
 *  letter Mail files (spec/16, S16.5), its words in src/mail/words.ts (`letterKindWords`). */
export const LETTER_KINDS = ["trade", "waivers", "assigned", "commissioner", "league", "draft", "lineup", "positions", "scout", "recap", "patch"] as const;
export type LetterKind = (typeof LETTER_KINDS)[number];
export const letterKind = v.union(...LETTER_KINDS.map((kind) => v.literal(kind)));

/** The screens a letter's one link goes to with nothing more to name (S16.2, S16.8), each where
 *  what the letter reports shows or is acted on; their words and paths in src/mail/letterLinks.ts. */
export const LETTER_PLACES = ["trades", "transactions", "tactics", "squad", "scouting", "table", "draft", "patchNotes"] as const;
export type LetterPlace = (typeof LETTER_PLACES)[number];

/** Where a letter's one link goes: a screen, a gameweek's recap, or a league's settings, which only
 *  whoever runs the league opens (S16.8: a rule change links to League rules). */
export const letterLink = v.union(
  v.object({ to: v.union(...LETTER_PLACES.map((place) => v.literal(place))) }),
  v.object({ to: v.literal("recap"), gameweek: v.number() }),
  v.object({ to: v.literal("settings"), leagueId: v.id("leagues") }),
);
export type LetterLink = Infer<typeof letterLink>;

/** A letter's subject and body. */
export type Words = { subject: string; body: string };
