// scripts/record-match.mjs loads this under plain node: import only types, or other files by explicit `.ts` path.
// What any caught failure says, and how it reaches Convex's logs: not the football layer's, every caller's.

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
