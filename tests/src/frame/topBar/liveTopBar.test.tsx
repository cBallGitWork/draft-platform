// The top bar's live wiring (#526), with Convex faked by name: Continue in spec/12's order, an
// unread letter first, then a lineup the server says is due, else nowhere.

import { renderHook } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import { MAIL_PATH, MY_TEAM_PATH } from "../../../../src/frame/menu";
import { useLiveTopBar } from "../../../../src/frame/topBar/liveTopBar";
import { menuWords } from "../../../../src/frame/words";
import { unreadCount } from "../../../../src/mail/words";
import { A_LEAGUE_ID } from "../../../support/src/convexReact.harness";

const convex = vi.hoisted(() => ({ isDue: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../../support/src/convexReact.harness")).fakeConvexReact({ queries: { "lineup/lineupDue:isDue": convex.isDue } }),
);

beforeEach(() => {
  convex.isDue.mockReset();
  convex.isDue.mockReturnValue(false);
});

const UNREAD = 3;
const live = (unreadMail: number, leagueId: Id<"leagues"> | null = A_LEAGUE_ID) => renderHook(() => useLiveTopBar(unreadMail, leagueId)).result.current;
const TO_MAIL = { path: MAIL_PATH, reason: unreadCount(UNREAD) };
const TO_TACTICS = { path: MY_TEAM_PATH, reason: menuWords.tactics };

test("unread letters are the top bar's count, and Continue goes to Mail", () => {
  expect(live(UNREAD)).toEqual({ unreadMail: UNREAD, next: TO_MAIL });
});

test("with nothing unread, or the count still loading, there is no count and nothing to continue to", () => {
  // useLiveMail gives a count still loading as none.
  expect(live(0)).toEqual({ unreadMail: 0, next: null });
  convex.isDue.mockReturnValue(undefined);
  expect(live(0)).toEqual({ unreadMail: 0, next: null });
});

test("a lineup the server says is due, with nothing unread, is Continue's: his Tactics tab", () => {
  convex.isDue.mockReturnValue(true);
  expect(live(0)).toEqual({ unreadMail: 0, next: TO_TACTICS });
});

test("an unread letter still comes before a lineup that is due", () => {
  convex.isDue.mockReturnValue(true);
  expect(live(UNREAD).next).toEqual(TO_MAIL);
});

test("it asks lineup/lineupDue:isDue for the league the app is in at the minute, and not at all with none", () => {
  live(0);
  expect(convex.isDue).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, now: expect.any(Number) });
  convex.isDue.mockClear();
  live(0, null);
  expect(convex.isDue).toHaveBeenCalledWith("skip");
});
