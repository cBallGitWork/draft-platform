import * as Sentry from "@sentry/react";
import type { ReactNode } from "react";
import type { RootOptions } from "react-dom/client";
import { ReadFailed } from "../frame/ReadFailed";
import { LINK_CODE_PARAM } from "./liveApp";

// Error reports to Sentry (docs/PLAN.md, "No monitoring"). Off unless the build has a DSN, so dev
// and tests send nothing; Craig sets the DSN in Vercel. Errors only: no tracing, no replays.

/** The build's setting holding Sentry's DSN, the address reports go to. */
export const SENTRY_DSN_ENV = "VITE_SENTRY_DSN";
/** What Vercel's build tells a Vite app: which environment it is (production, preview) and the
 *  commit it was built from, so a report names its release. */
export const VERCEL_ENV_ENV = "VITE_VERCEL_ENV";
export const COMMIT_SHA_ENV = "VITE_VERCEL_GIT_COMMIT_SHA";
/** A build outside Vercel, such as `vite build` on a laptop with a DSN set. */
export const LOCAL_ENVIRONMENT = "local";

/** What stands in for anything personal a report would otherwise carry. */
export const REMOVED = "[removed]";
/** An email address anywhere in a report: a message, a breadcrumb, a URL. */
const EMAIL = /[^\s"'<>@/:?&=]+@[^\s"'<>@/:?&=]+\.[^\s"'<>@/:?&=]+/g;
/** A sign-in link's code in an address, which a navigation breadcrumb keeps after the app takes
 *  it out of the address bar. */
const LINK_CODE = new RegExp(`([?&]${LINK_CODE_PARAM}=)[^&#"\\s]*`, "g");

/** Sentry collects none of who is signed in, cookies, headers, query strings or bodies. */
export const NO_PERSONAL_DATA = { userInfo: false, cookies: false, httpHeaders: false, urlQueryParams: false, httpBodies: [] };

type BuildEnv = Record<string, string | boolean | undefined>;

/** What the console says when a report couldn't be scrubbed, so it was never sent. */
export const UNSCRUBBED_LOG = "An error report couldn't be cleaned of personal data, so it wasn't sent:";

/** A report with nothing personal left in it: no user, no email address, no sign-in code. It's a
 *  private beta of friends; their names and emails stay out of a third party's logs. A report that
 *  can't be read as text is dropped (null), and the console says so. */
export function scrubbed<Event extends object>(event: Event): Event | null {
  const { user: _user, ...rest } = event as Event & { user?: unknown };
  try {
    const text = JSON.stringify(rest).replace(EMAIL, REMOVED).replace(LINK_CODE, `$1${REMOVED}`);
    return JSON.parse(text) as Event;
  } catch (error) {
    console.warn(UNSCRUBBED_LOG, error);
    return null;
  }
}

/** Starts Sentry when the build has a DSN, and says whether it did. */
export function startErrorReports(env: BuildEnv = import.meta.env): boolean {
  const dsn = env[SENTRY_DSN_ENV];
  if (typeof dsn !== "string" || dsn === "") return false;
  const environment = env[VERCEL_ENV_ENV];
  const release = env[COMMIT_SHA_ENV];
  Sentry.init({
    dsn,
    environment: typeof environment === "string" && environment !== "" ? environment : LOCAL_ENVIRONMENT,
    release: typeof release === "string" && release !== "" ? release : undefined,
    dataCollection: NO_PERSONAL_DATA,
    tracesSampleRate: 0,
    beforeSend: (event) => scrubbed(event),
  });
  return true;
}

/** createRoot's options once Sentry runs: an error a boundary caught (ShellFailed, a route's
 *  ErrorScreen) is reported too. Nothing changes without Sentry, so React's own logging stays. */
export function reportingRootOptions(reporting: boolean): RootOptions | undefined {
  return reporting ? { onCaughtError: Sentry.reactErrorHandler() } : undefined;
}

/** The app's outermost boundary: what anything the inner ones miss shows, the failed-read screen
 *  every page uses, and its report. */
export function ReportedApp({ children }: { children: ReactNode }) {
  return (
    <Sentry.ErrorBoundary fallback={({ error, resetError }) => <ReadFailed error={error} onRetry={resetError} />}>
      {children}
    </Sentry.ErrorBoundary>
  );
}
