import { ConvexError } from "convex/values";
import { isOldCall, markNewVersion, newVersionOut } from "./newVersion";
import { newVersionWords } from "./words";

// How every live seam answers a failed call to the server: a refusal comes back as the server's
// own words (each convex/ module's refusals); any other failure is logged and said plainly.

/** A change: it resolves with null once made, or with the words saying why not. It never rejects. */
export type Change = Promise<string | null>;

/** The server's words for a refusal, or null for any other failure. */
const refusalIn = (error: unknown) => (error instanceof ConvexError && typeof error.data === "string" ? error.data : null);

/** What `attempt` resolves with, the server's words if it refused, or `failedWords` (and the
 *  failure logged as what `doing` failed) if anything else went wrong. Once a new version is out
 *  that this tab can't work with, nothing is sent, and a call the server refused as older code's
 *  says so too: both answer with the bar's words (newVersion.ts; spec/12, S12.13). */
export async function answerOf<T>(attempt: () => Promise<T>, doing: string, failedWords: string): Promise<T | string> {
  if (newVersionOut()) return newVersionWords;
  try {
    return await attempt();
  } catch (error) {
    if (isOldCall(error)) {
      console.error(`${doing} failed:`, error);
      markNewVersion();
      return newVersionWords;
    }
    const refusal = refusalIn(error);
    if (refusal === null) console.error(`${doing} failed:`, error);
    return refusal ?? failedWords;
  }
}

/** Null once `change` is made, else as `answerOf`. */
export const refusalOf = (change: () => Promise<unknown>, doing: string, failedWords: string): Change =>
  answerOf(
    async () => {
      await change();
      return null;
    },
    doing,
    failedWords,
  );
