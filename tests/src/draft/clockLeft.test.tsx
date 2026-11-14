// The pick clock's time left (src/draft/ClockLeft.tsx): counted down each second, frozen while the
// draft is paused, and right from the first frame a resume draws (#1437).

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MINUTE_MS, SECOND_MS } from "../../../convex/shared/time";
import { ClockLeft, type PickClock } from "../../../src/draft/ClockLeft";
import { timeLeftWords } from "../../../src/draft/words";
import { forgetServerTime, syncServerTime } from "../../../src/shared/serverClock";

const STARTS = Date.parse("2026-11-14T12:00:00Z");
const PICK_MS = MINUTE_MS;
const onTheClock = (clock: PickClock) => ({ pick: 1, clock, pickSeconds: PICK_MS / SECOND_MS });

beforeEach(() => vi.useFakeTimers({ now: STARTS }));
afterEach(() => vi.useRealTimers());

it("counts down, stands still while paused, and draws the time left the moment it resumes", () => {
  const running = { startsAt: STARTS, endsAt: STARTS + PICK_MS } as PickClock;
  const { rerender } = render(<ClockLeft onTheClock={onTheClock(running)} />);
  act(() => vi.advanceTimersByTime(20 * SECOND_MS));
  expect(screen.getByText(timeLeftWords(40 * SECOND_MS))).toBeTruthy();

  rerender(<ClockLeft onTheClock={onTheClock({ ...running, pausedAt: STARTS + 20 * SECOND_MS })} />);
  act(() => vi.advanceTimersByTime(5 * MINUTE_MS));
  expect(screen.getByText(timeLeftWords(40 * SECOND_MS))).toBeTruthy();

  // The resume moves the pick's end on by the five minutes it was paused.
  rerender(<ClockLeft onTheClock={onTheClock({ ...running, endsAt: running.endsAt + 5 * MINUTE_MS })} />);
  expect(screen.getByText(timeLeftWords(40 * SECOND_MS))).toBeTruthy();
});

it("S04.22: Ann's laptop clock 2 minutes slow, her draft clock shows the time left by the server's", async () => {
  vi.setSystemTime(STARTS - 2 * MINUTE_MS);
  await syncServerTime(async () => STARTS);
  try {
    render(<ClockLeft onTheClock={onTheClock({ startsAt: STARTS - 20 * SECOND_MS, endsAt: STARTS + 40 * SECOND_MS } as PickClock)} />);
    expect(screen.getByText(timeLeftWords(40 * SECOND_MS))).toBeTruthy();
  } finally {
    forgetServerTime();
  }
});
