// What every screen says alike, in one place for Craig to change in the pull request.

/** What a screen says when a change or a read failed for any reason but the server's refusal (src/refusal.ts):
 *  `outcome` is what that left, such as "nothing changed". */
export const failedWords = (outcome: string) => `Something went wrong, so ${outcome}. Check your connection and try again.`;
