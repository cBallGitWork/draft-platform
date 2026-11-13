// useMinute: the start of the current minute, moving on at each next one, and still ticking after
// a timer that fires before its minute is up (#1437).

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MINUTE_MS, SECOND_MS } from "../../../convex/shared/time";
import { useMinute } from "../../../src/shared/useMinute";

const NOON = Date.parse("2026-11-14T12:00:00Z");

beforeEach(() => vi.useFakeTimers({ now: NOON + 30 * SECOND_MS }));
afterEach(() => vi.useRealTimers());

it("moves on at each minute's turn", () => {
  const { result } = renderHook(() => useMinute());
  expect(result.current).toBe(NOON);
  act(() => vi.advanceTimersByTime(30 * SECOND_MS));
  expect(result.current).toBe(NOON + MINUTE_MS);
  act(() => vi.advanceTimersByTime(MINUTE_MS));
  expect(result.current).toBe(NOON + 2 * MINUTE_MS);
});

it("keeps ticking after its timer fires with the minute not yet up, as when the clock is put back", () => {
  const { result } = renderHook(() => useMinute());
  vi.setSystemTime(NOON + 20 * SECOND_MS);
  act(() => vi.advanceTimersByTime(30 * SECOND_MS));
  expect(result.current).toBe(NOON);
  act(() => vi.advanceTimersByTime(2 * MINUTE_MS));
  expect(result.current).toBe(NOON + 2 * MINUTE_MS);
});
