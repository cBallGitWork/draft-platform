// Types for live-site.mjs, so playwright.live.config.ts and tests/live/ typecheck their imports.
export const LIVE_SITE_URL: string;
export const CHECK_ENV: {
  readonly email: "RELEASE_CHECK_EMAIL";
  readonly resendKey: "RELEASE_CHECK_RESEND_KEY";
  readonly site: "RELEASE_CHECK_SITE";
};
export function checkSite(): string;
export function checkSecrets(): { email: string; resendKey: string } | null;
