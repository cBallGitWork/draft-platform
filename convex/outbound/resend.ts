// Resend's API address, in its one home: the app sends its emails through it (email.ts), and the
// setup command and the after-release check call it too. No imports, so `scripts/` can read it in
// plain Node.

/** Resend's API (ARCHITECTURE.md, Services). */
export const RESEND_API_URL = "https://api.resend.com";
