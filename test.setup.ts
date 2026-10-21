// Every test project's setup (vitest.config.ts says why): the real timers back after each test.

import { afterEach, vi } from "vitest";

afterEach(() => {
  vi.useRealTimers();
});
