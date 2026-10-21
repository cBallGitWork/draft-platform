// The convex project's setup (vitest.config.ts): a test fails if it logged with console.error and
// didn't say it meant to, by calling silenceConsoleError() from convex/test.harness.ts. A logged
// error a test didn't expect would otherwise pass green, unseen. It sits outside convex/, so Convex
// never loads it as one of its modules.

import { afterEach, beforeEach, expect, vi, type MockInstance } from "vitest";

let consoleError: MockInstance<typeof console.error>;
let optedIn = false;

/** The test means to log with console.error: the guard lets it, and the spy is quiet. The spy is
 *  returned to check what was logged. */
export function allowConsoleError(): MockInstance<typeof console.error> {
  optedIn = true;
  return consoleError.mockImplementation(() => {});
}

beforeEach(() => {
  // Records each call and still prints it, so a stray one is seen as well as failed.
  consoleError = vi.spyOn(console, "error");
  optedIn = false;
});

afterEach(() => {
  if (optedIn) return;
  expect(consoleError.mock.calls, "console.error was called; a test that means it calls silenceConsoleError()").toEqual(
    [],
  );
});
