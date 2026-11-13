// The top bar's live wiring (#526), with Convex faked by name: Continue in spec/12's order, an
// unread letter first, then a lineup the server says is due, then a trade offer waiting for his
// answer, else nowhere; and the minute it is
// asked at held by its watch alone, so the shell doesn't re-render each minute.

import { act, render } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import { MINUTE_MS } from "../../../../convex/shared/time";
import { MAIL_PATH, MY_TEAM_PATH, TRADES_PATH } from "../../../../src/frame/menu";
import { useLiveTopBar } from "../../../../src/frame/topBar/liveTopBar";
import type { TopBarState } from "../../../../src/frame/topBar/topBarState";
import { menuWords } from "../../../../src/shared/words";
import { unreadCount } from "../../../../src/mail/words";
import { A_LEAGUE_ID } from "../../../support/src/convexReact.harness";

const convex = vi.hoisted(() => ({ isDue: vi.fn(), countMine: vi.fn(), offersWaiting: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../../support/src/convexReact.harness")).fakeConvexReact({
    queries: {
      "lineup/lineupDue:isDue": convex.isDue,
      "waivers/waiverClaims:countMine": convex.countMine,
      "trades/tradeOffers:countWaitingForMe": convex.offersWaiting,
    },
  }),
);

beforeEach(() => {
  convex.isDue.mockReturnValue(false);
  convex.countMine.mockReturnValue(0);
  convex.offersWaiting.mockReturnValue(0);
});

const UNREAD = 3;
const TO_MAIL = { path: MAIL_PATH, reason: unreadCount(UNREAD) };
const TO_TACTICS = { path: MY_TEAM_PATH, reason: menuWords.tactics };

/** The hook in a shell of its own, rendering its watch as liveApp.tsx does: the latest top bar,
 *  and how many times the shell rendered. */
function liveShell(unreadMail: number, leagueId: Id<"leagues"> | null = A_LEAGUE_ID) {
  const seen = { topBar: null as TopBarState | null, renders: 0 };
  function Shell() {
    const { topBar, watch } = useLiveTopBar(unreadMail, leagueId);
    seen.topBar = topBar;
    seen.renders += 1;
    return <>{watch}</>;
  }
  render(<Shell />);
  return seen;
}
const live = (unreadMail: number, leagueId?: Id<"leagues"> | null) => liveShell(unreadMail, leagueId).topBar;

test("unread letters are the top bar's count, and Continue goes to Mail", () => {
  expect(live(UNREAD)).toEqual({ unreadMail: UNREAD, next: TO_MAIL, pendingClaims: 0 });
});

test("with nothing unread, or the count still loading, there is no count and nothing to continue to", () => {
  // useLiveMail gives a count still loading as none.
  expect(live(0)).toEqual({ unreadMail: 0, next: null, pendingClaims: 0 });
  convex.isDue.mockReturnValue(undefined);
  expect(live(0)).toEqual({ unreadMail: 0, next: null, pendingClaims: 0 });
});

test("a lineup the server says is due, with nothing unread, is Continue's: his Tactics tab", () => {
  convex.isDue.mockReturnValue(true);
  expect(live(0)).toEqual({ unreadMail: 0, next: TO_TACTICS, pendingClaims: 0 });
});

test("an unread letter still comes before a lineup that is due", () => {
  convex.isDue.mockReturnValue(true);
  expect(live(UNREAD)?.next).toEqual(TO_MAIL);
});

test("it asks lineup/lineupDue:isDue for the league the app is in at the minute, and not at all with none", () => {
  live(0);
  expect(convex.isDue).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID, now: expect.any(Number) });
  convex.isDue.mockClear();
  convex.isDue.mockReturnValue(true);
  expect(live(0, null)).toEqual({ unreadMail: 0, next: null, pendingClaims: 0 });
  expect(convex.isDue).not.toHaveBeenCalled();
});

test("a minute passing asks again at the new minute without re-rendering the shell", () => {
  vi.useFakeTimers();
  const shell = liveShell(0);
  const rendersBefore = shell.renders;
  convex.isDue.mockClear();
  act(() => vi.advanceTimersByTime(MINUTE_MS));
  expect(convex.isDue).toHaveBeenCalledOnce();
  expect(shell.renders).toBe(rendersBefore);
});

test("switching league, Continue doesn't carry the last league's lineup over before the new one answers", () => {
  const OTHER_LEAGUE_ID = "league-2" as Id<"leagues">;
  let next: TopBarState["next"] = null;
  function Shell({ leagueId }: { leagueId: Id<"leagues"> }) {
    const { topBar, watch } = useLiveTopBar(0, leagueId);
    next = topBar.next;
    return <>{watch}</>;
  }
  convex.isDue.mockReturnValue(true);
  const { rerender } = render(<Shell leagueId={A_LEAGUE_ID} />);
  expect(next).toEqual(TO_TACTICS);
  convex.isDue.mockReturnValue(undefined);
  rerender(<Shell leagueId={OTHER_LEAGUE_ID} />);
  expect(next).toBeNull();
});

test("while the new minute's answer loads, Continue stays where the last answer sent it", () => {
  vi.useFakeTimers();
  convex.isDue.mockReturnValue(true);
  const shell = liveShell(0);
  const rendersBefore = shell.renders;
  convex.isDue.mockReturnValueOnce(undefined);
  act(() => vi.advanceTimersByTime(MINUTE_MS));
  expect(shell.topBar).toEqual({ unreadMail: 0, next: TO_TACTICS, pendingClaims: 0 });
  expect(shell.renders).toBe(rendersBefore);
});

test("the manager's pending claims in the league the app is in are the Transactions tab's count (#1200), none while it loads", () => {
  convex.countMine.mockReturnValue(3);
  expect(live(0)?.pendingClaims).toBe(3);
  expect(convex.countMine).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID });
  convex.countMine.mockReturnValue(undefined);
  expect(live(0)?.pendingClaims).toBe(0);
});

test("a trade offer waiting for his answer is Continue's after a letter and a lineup: the Offers tab (#1553)", () => {
  const TO_OFFERS = { path: TRADES_PATH, reason: menuWords.offers };
  convex.offersWaiting.mockReturnValue(1);
  expect(live(0)?.next).toEqual(TO_OFFERS);
  expect(convex.offersWaiting).toHaveBeenCalledWith({ leagueId: A_LEAGUE_ID });
  expect(live(UNREAD)?.next).toEqual(TO_MAIL);
  convex.isDue.mockReturnValue(true);
  expect(live(0)?.next).toEqual(TO_TACTICS);
  convex.isDue.mockReturnValue(false);
  convex.offersWaiting.mockReturnValue(undefined);
  expect(live(0)?.next).toBeNull();
});
