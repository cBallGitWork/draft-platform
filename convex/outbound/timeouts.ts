// How long the app waits on a service it calls before giving up (AbortSignal.timeout), so a
// service that takes the request and never answers fails the call promptly, and the caller logs
// it, instead of holding the action until Convex's own limit stops it.

/** A Healthchecks ping, the lead's wake-up to GitHub. */
export const OUTBOUND_TIMEOUT_MS = 10_000;

/** Claude writing a scout's report or a recap: a few hundred tokens, well inside a minute. */
export const WRITING_TIMEOUT_MS = 60_000;
