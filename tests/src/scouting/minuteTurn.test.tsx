// Scouting across the minute's turn (#1747): your player at a selected player's position is read
// at the screen's minute, so each minute asks again; the last answer stays up while the next loads,
// so Compare with your… doesn't vanish when the clock moves on. The live seam's read, Convex faked.

import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { MINUTE_MS } from "../../../convex/shared/time";
import { liveScouting } from "../../../src/scouting/liveScouting";
import { compareWithYourWords } from "../../../src/scouting/words";
import { answeredAtFirstMinute } from "../../support/src/convexReact.harness";
import { HELD, openOnAll, rowOf, SAKA } from "../../support/src/scoutingScreen.harness";

const convex = vi.hoisted(() => ({ yourPlayer: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "scouting/yourPlayer:at": convex.yourPlayer },
  }),
);

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

test("Compare with your… stays on a selected player's panel across the minute's turn", async () => {
  convex.yourPlayer.mockImplementation(answeredAtFirstMinute({ player: { position: "CM", code: SAKA.code, name: "Saka" }, squadFull: false }));
  const app = await openOnAll(HELD);
  // Read through the live seam from the panel's first render: it mounts when a row is selected.
  app.scouting.useYourPlayer.mockImplementation(liveScouting.useYourPlayer);
  await userEvent.click(rowOf("Rice"));
  const compareWithYours = () => screen.queryByRole("button", { name: compareWithYourWords("CM", "Saka") });
  expect(compareWithYours()).toBeTruthy();

  act(() => vi.advanceTimersByTime(MINUTE_MS));
  expect(new Set(convex.yourPlayer.mock.calls.map(([{ now }]) => now)).size).toBe(2);
  expect(compareWithYours()).toBeTruthy();
});
