import { OUTSIDE_WORLD_SETTING } from "./deploymentSettings.ts";

// football.ts loads this under plain node (scripts/record-match.mjs): import other files by explicit `.ts` path.
// Every read and send to an outside service (FPL, the Premier League, Sportmonks, Resend, Anthropic)
// goes to the address `outsideUrl` gives, so an e2e run's throwaway server can point them all at one
// fake server (spec/20, S20.17; #2288). Unset, as on live and development, each goes where it says.

/** `url` as this deployment reaches it: itself, or, where OUTSIDE_WORLD_URL is set, that address
 *  with the real host as the first part of the path, so the one fake server knows which service
 *  was asked (`https://api.resend.com/emails` becomes `<fake>/api.resend.com/emails`). */
export function outsideUrl(url: string): string {
  const fake = process.env[OUTSIDE_WORLD_SETTING];
  if (!fake) return url;
  const real = new URL(url);
  return `${fake.replace(/\/+$/, "")}/${real.host}${real.pathname}${real.search}`;
}
