// A letter's words, the shape every *Words.ts file returns. Its own module, so those files and
// letterWords.ts, which imports several of them, share it without importing one another.

/** A letter's subject and body. */
export type Words = { subject: string; body: string };
