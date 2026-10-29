// scripts/record-match.mjs loads this under plain node: import only types, or other files by explicit `.ts` path.

/** What a caught failure says, whether or not it was thrown as an Error. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The error's message, logged so a failure is seen in Convex's logs as well as wherever the caller records it. */
export function logFailure(what: string, error: unknown): string {
  const message = errorMessage(error);
  console.error(`${what}: ${message}`);
  return message;
}

/** A run's outcome: what `work` returns, or `{ ok: false, error }` with the failure logged under
 *  `failureWords` when it throws. Each feed wraps its run in it before recording the run's row. */
export async function outcomeOf<Ok extends { ok: true }>(
  failureWords: string,
  work: () => Promise<Ok>,
): Promise<Ok | { ok: false; error: string }> {
  try {
    return await work();
  } catch (error: unknown) {
    return { ok: false, error: logFailure(failureWords, error) };
  }
}
