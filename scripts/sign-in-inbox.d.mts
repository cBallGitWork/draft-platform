// Types for sign-in-inbox.mjs, so tests/live/signIn.live.spec.ts typechecks its import.
export const RECEIVED_PATH: string;
export const RECENT_LIMIT: number;
export const WAIT_MS: number;
export const POLL_MS: number;
export const CLOCK_SKEW_MS: number;

export type ReceivedEmail = { id: string; to?: string[]; subject: string; created_at: string };

export function linkIn(body: string | null | undefined, siteUrl: string): string | null;
export function newestMatch(emails: ReceivedEmail[], match: { to: string; subject: string; since: number }): ReceivedEmail | null;
export function receivedSignInLink(options: {
  apiKey: string;
  to: string;
  subject: string;
  siteUrl: string;
  since: number;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  apiUrl?: string;
  waitMs?: number;
  pollMs?: number;
}): Promise<string>;
