// The convex project's setup (vitest.config.ts): a test fails if it logged with console.error and
// didn't say it meant to, by calling silenceConsoleError(). A logged error a test didn't expect
// would otherwise pass green, unseen.

import { afterEach, beforeEach, expect, vi, type MockInstance } from "vitest";

let consoleError: MockInstance<typeof console.error>;
let silenced = false;

/** Keeps console.error quiet for the test, where a logged failure is what it causes, and lets it
 *  pass the guard. The spy is returned to check what was logged. Tests import it from
 *  convex/test.harness.ts. */
export function silenceConsoleError(): MockInstance<typeof console.error> {
  silenced = true;
  return consoleError.mockImplementation(() => {});
}

beforeEach(() => {
  // Records each call and still prints it, so a stray one is seen as well as failed.
  consoleError = vi.spyOn(console, "error");
  silenced = false;
});

afterEach(() => {
  if (silenced) return;
  expect(consoleError.mock.calls, "console.error was called; a test that means it calls silenceConsoleError()").toEqual(
    [],
  );
});
