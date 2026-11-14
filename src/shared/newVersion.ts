import { useSyncExternalStore } from "react";
import { SITE_VERSION } from "../../convex/shared/siteVersion";

// Whether a release is out that this tab's code can't work with (spec/12, S12.13). Two things
// say so: the server's version ahead of the one this tab was built with
// (convex/shared/siteVersion.ts), and a call the server refused for its shape, a function gone
// or its arguments changed. Once out, it stays out until the page reloads: the bar shows, and
// refusal.ts sends no more saves, so nothing typed in an old tab is saved wrongly.

/** What Convex's server says, in a failed call's message, when the tab called a function it no
 *  longer has or with arguments it no longer takes. Convex words these itself, so a production
 *  deployment doesn't hide them behind "Server Error" as it does a function's own throw. */
const OLD_CALL = /Could not find public function|ArgumentValidationError/;

let out = false;
const listeners = new Set<() => void>();

/** Whether a new version is out that this tab can't work with. */
export const newVersionOut = () => out;

/** Says a new version is out; every bar watching shows. */
export function markNewVersion() {
  if (out) return;
  out = true;
  for (const listener of listeners) listener();
}

/** Whether `error` is the server refusing a call from older code. */
export const isOldCall = (error: unknown) => error instanceof Error && OLD_CALL.test(error.message);

/** Whether the server's version, `serverVersion`, is ahead of this tab's; undefined while it loads. */
export const serverIsNewer = (serverVersion: number | undefined) => serverVersion !== undefined && serverVersion > SITE_VERSION;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether a new version is out, live (a hook). */
export const useNewVersion = () => useSyncExternalStore(subscribe, newVersionOut);

/** For tests: forgets that a new version is out, as a reload does. */
export function forgetNewVersion() {
  out = false;
  for (const listener of listeners) listener();
}
