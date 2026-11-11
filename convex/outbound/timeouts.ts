import { MINUTE_MS } from "../shared/time";

// How long the app waits on a service it calls before giving up (AbortSignal.timeout), so a
// service that takes the request and never answers fails the call promptly, and the caller logs
// it, instead of holding the action until Convex's own limit stops it.

/** An email to Resend, a Healthchecks ping, the lead's wake-up to GitHub. */
export const OUTBOUND_TIMEOUT_MS = 10_000;
/** A request to Claude, which writes its whole reply before it answers. */
export const CLAUDE_TIMEOUT_MS = 2 * MINUTE_MS;
