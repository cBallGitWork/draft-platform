// Guards the shared teardown in vitest.config.ts and tests/support/test.setup.ts: the first test leaves a
// stubbed global, a stubbed env, a spy and fake timers behind, and the second finds them all gone.
// The tests in one file run in order, so the second always runs after the first.

import { expect, test, vi } from "vitest";

const realFetch = globalThis.fetch;
const realNow = Date.now;
const target = { read: () => "real" };

test("a test leaves a stubbed global, a stubbed env, a spy and fake timers behind", () => {
  vi.stubGlobal("fetch", () => "stubbed");
  vi.stubEnv("TEST_SETUP_PROBE", "stubbed");
  vi.spyOn(target, "read").mockReturnValue("spied");
  vi.useFakeTimers();

  expect(globalThis.fetch).not.toBe(realFetch);
  expect(process.env.TEST_SETUP_PROBE).toBe("stubbed");
  expect(target.read()).toBe("spied");
  expect(vi.isFakeTimers()).toBe(true);
});

test("the next test finds every one of them put back", () => {
  expect(globalThis.fetch).toBe(realFetch);
  expect(process.env.TEST_SETUP_PROBE).toBeUndefined();
  expect(target.read()).toBe("real");
  expect(vi.isFakeTimers()).toBe(false);
  expect(Date.now).toBe(realNow);
});
