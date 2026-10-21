// Every test project's setup (vitest.config.ts): a test that stops the clock with fake timers gets
// the real ones back after it, so no test file needs its own afterEach for them.

import { afterEach, vi } from "vitest";

afterEach(() => {
  vi.useRealTimers();
});
