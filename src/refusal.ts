import { ConvexError } from "convex/values";

// How every live seam answers a failed call to the server: a refusal comes back as the server's
// own words (each convex/ module's refusals); any other failure is logged and said plainly.

/** The server's words for a refusal, or null for any other failure. */
export const refusalIn = (error: unknown) => (error instanceof ConvexError && typeof error.data === "string" ? error.data : null);

/** What `attempt` resolves with, the server's words if it refused, or `failedWords` (and the
 *  failure logged as what `doing` failed) if anything else went wrong. */
export async function answerOf<T>(attempt: () => Promise<T>, doing: string, failedWords: string): Promise<T | string> {
  try {
    return await attempt();
  } catch (error) {
    const refusal = refusalIn(error);
    if (refusal === null) console.error(`${doing} failed:`, error);
    return refusal ?? failedWords;
  }
}

/** Null once `change` is made, else as `answerOf`. */
export const refusalOf = (change: () => Promise<unknown>, doing: string, failedWords: string): Promise<string | null> =>
  answerOf(
    async () => {
      await change();
      return null;
    },
    doing,
    failedWords,
  );
