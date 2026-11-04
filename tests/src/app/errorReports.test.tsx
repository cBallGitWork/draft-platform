// Error reports to Sentry: off without a DSN, started with one, and nothing personal sent.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { silenceConsoleError } from "../../support/console.setup";
import {
  COMMIT_SHA_ENV,
  LOCAL_ENVIRONMENT,
  NO_PERSONAL_DATA,
  REMOVED,
  ReportedApp,
  SENTRY_DSN_ENV,
  VERCEL_ENV_ENV,
  reportingRootOptions,
  scrubbed,
  startErrorReports,
} from "../../../src/app/errorReports";
import { readFailedWords, retryWords } from "../../../src/frame/words";

const sentry = vi.hoisted(() => ({ init: vi.fn() }));
vi.mock("@sentry/react", async (importOriginal) => ({ ...(await importOriginal<object>()), init: sentry.init }));

const DSN = "https://key@o1.ingest.sentry.io/2";

test("without a DSN, Sentry never starts and the root keeps React's own options", () => {
  expect(startErrorReports({})).toBe(false);
  expect(startErrorReports({ [SENTRY_DSN_ENV]: "" })).toBe(false);
  expect(sentry.init).not.toHaveBeenCalled();
  expect(reportingRootOptions(false)).toBeUndefined();
});

test("with a DSN, Sentry starts with Vercel's environment and commit, no tracing and no personal data", () => {
  expect(startErrorReports({ [SENTRY_DSN_ENV]: DSN, [VERCEL_ENV_ENV]: "preview", [COMMIT_SHA_ENV]: "abc123" })).toBe(true);
  expect(sentry.init).toHaveBeenCalledWith(
    expect.objectContaining({ dsn: DSN, environment: "preview", release: "abc123", dataCollection: NO_PERSONAL_DATA, tracesSampleRate: 0 }),
  );
  expect(reportingRootOptions(true)?.onCaughtError).toBeTypeOf("function");
});

test("a build outside Vercel reports as local, with no release", () => {
  startErrorReports({ [SENTRY_DSN_ENV]: DSN });
  expect(sentry.init).toHaveBeenCalledWith(expect.objectContaining({ environment: LOCAL_ENVIRONMENT, release: undefined }));
});

test("a report loses its user, every email address and a sign-in link's code", () => {
  const event = {
    user: { email: "craig@example.com", id: "u1" },
    message: "craig@example.com isn't allowed",
    breadcrumbs: [{ data: { from: "/?code=123456&x=1", to: "/" } }],
  };
  const sent = scrubbed(event);
  expect(sent).not.toHaveProperty("user");
  expect(sent.message).toBe(`${REMOVED} isn't allowed`);
  expect(sent.breadcrumbs[0]?.data.from).toBe(`/?code=${REMOVED}&x=1`);
});

test("anything the inner boundaries miss shows the failed-read screen, and Retry draws the app again", async () => {
  silenceConsoleError();
  let broken = true;
  function Breaks() {
    if (broken) throw new Error("drawing failed");
    return <p>drawn</p>;
  }
  render(
    <ReportedApp>
      <Breaks />
    </ReportedApp>,
  );
  expect(screen.getByText(readFailedWords)).toBeTruthy();
  broken = false;
  await userEvent.click(screen.getByRole("button", { name: retryWords }));
  expect(screen.getByText("drawn")).toBeTruthy();
});
