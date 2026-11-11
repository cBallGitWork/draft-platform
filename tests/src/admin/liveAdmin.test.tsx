// The admin seam's live wiring, with Convex's queries and mutations faked by name: what a blank
// search asks of the server, the time the feeds are judged at, and what a change resolves with when
// the server makes it, refuses it, or can't be reached.

import { act, renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { expect, test, vi } from "vitest";
import { silenceConsoleError } from "../../support/console.setup";
import { useLiveAdmin } from "../../../src/admin/liveAdmin";
import { changeFailedWords } from "../../../src/shared/words";
import { MINUTE_MS } from "../../../convex/shared/time";
import { refusals } from "../../../convex/shared/leagueAccess";

const convex = vi.hoisted(() => ({
  find: vi.fn(),
  feeds: vi.fn(),
  setPosition: vi.fn(),
  approvePlayer: vi.fn(),
  approveClub: vi.fn(),
  setChangeThresholds: vi.fn(),
  setClubColours: vi.fn(),
  forAdmin: vi.fn(),
  setAvailability: vi.fn(),
  platformSettings: vi.fn(),
  savePlatformSettings: vi.fn(),
}));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: {
      "positions/playerPositions:find": convex.find,
      "admin/feeds:feeds": convex.feeds,
      "availability/availability:forAdmin": convex.forAdmin,
      "admin/platformSettings:settings": convex.platformSettings,
    },
    mutations: {
      "positions/playerPositions:approvePlayer": convex.approvePlayer,
      "positions/playerPositions:approveClub": convex.approveClub,
      "positions/playerPositions:setPosition": convex.setPosition,
      "positions/playerPositions:removePosition": vi.fn(),
      "positions/positionSettings:setApproveMode": vi.fn(),
      "positions/positionSettings:setChangeThresholds": convex.setChangeThresholds,
      "football/clubKits:set": convex.setClubColours,
      "availability/availability:set": convex.setAvailability,
      "admin/platformSettings:save": convex.savePlatformSettings,
    },
  }),
);

const seam = () => renderHook(() => useLiveAdmin()).result.current;

test("a search asks positions/playerPositions:find, and blank text asks nothing and finds no one", () => {
  const found = [{ code: 3, name: "Woltemade", fullName: "Nick Woltemade", clubCode: 4, positions: [] }];
  convex.find.mockReturnValue(found);
  expect(renderHook(() => useLiveAdmin().useFoundPlayers("Woltemade")).result.current).toBe(found);
  expect(convex.find).toHaveBeenLastCalledWith({ text: "Woltemade" });

  expect(renderHook(() => useLiveAdmin().useFoundPlayers("  ")).result.current).toEqual([]);
  expect(convex.find).toHaveBeenLastCalledWith("skip");
});

test("the feeds are asked of admin/feeds:feeds at the start of the minute, and asked again when the next begins", () => {
  const minute = Date.parse("2026-10-17T12:00:00Z");
  vi.useFakeTimers({ now: minute + 40_000 });
  renderHook(() => useLiveAdmin().useFeeds());
  expect(convex.feeds).toHaveBeenLastCalledWith({ now: minute });

  act(() => vi.advanceTimersByTime(19_999));
  expect(convex.feeds).toHaveBeenLastCalledWith({ now: minute });
  act(() => vi.advanceTimersByTime(1));
  expect(convex.feeds).toHaveBeenLastCalledWith({ now: minute + MINUTE_MS });
  act(() => vi.advanceTimersByTime(MINUTE_MS));
  expect(convex.feeds).toHaveBeenLastCalledWith({ now: minute + 2 * MINUTE_MS });
});

test("a change positions/playerPositions:setPosition makes resolves with no problem", async () => {
  convex.setPosition.mockResolvedValue(null);
  expect(await seam().setPosition(3, "SS")).toBeNull();
  expect(convex.setPosition).toHaveBeenCalledWith({ code: 3, position: "SS" });
});

test("new thresholds go to positions/positionSettings:setChangeThresholds", async () => {
  convex.setChangeThresholds.mockResolvedValue(null);
  expect(await seam().setChangeThresholds({ flagAfter: 2, removeAfter: 5 })).toBeNull();
  expect(convex.setChangeThresholds).toHaveBeenCalledWith({ flagAfter: 2, removeAfter: 5 });
});

test("the site's settings are asked of admin/platformSettings:settings, and saved by admin/platformSettings:save", async () => {
  const settings = { statCorrectionWindowMinutes: 90, scoutsPerTeam: 2, matchdayHoursBefore: 4, matchdayHoursAfter: 0 };
  convex.platformSettings.mockReturnValue(settings);
  expect(renderHook(() => useLiveAdmin().usePlatformSettings()).result.current).toBe(settings);
  expect(convex.platformSettings).toHaveBeenLastCalledWith({});

  convex.savePlatformSettings.mockResolvedValue(null);
  expect(await seam().savePlatformSettings(settings)).toBeNull();
  expect(convex.savePlatformSettings).toHaveBeenCalledWith(settings);
});

test("a club's colours go to football/clubKits:set", async () => {
  convex.setClubColours.mockResolvedValue(null);
  const colours = { primary: "#D71920", secondary: "#FFFFFF", pattern: "stripes" as const };
  expect(await seam().setClubColours(999, colours)).toBeNull();
  expect(convex.setClubColours).toHaveBeenCalledWith({ code: 999, ...colours });
});

test("a player's availability is asked of availability/availability:forAdmin, and no player asks nothing", () => {
  renderHook(() => useLiveAdmin().useAvailabilityOf(5));
  expect(convex.forAdmin).toHaveBeenLastCalledWith({ code: 5 });
  renderHook(() => useLiveAdmin().useAvailabilityOf(null));
  expect(convex.forAdmin).toHaveBeenLastCalledWith("skip");
});

test("an availability set by hand, or given back to the feed, goes to availability/availability:set", async () => {
  convex.setAvailability.mockResolvedValue(null);
  expect(await seam().setAvailability(5, "out")).toBeNull();
  expect(convex.setAvailability).toHaveBeenLastCalledWith({ code: 5, availability: "out" });
  expect(await seam().setAvailability(5, null)).toBeNull();
  expect(convex.setAvailability).toHaveBeenLastCalledWith({ code: 5, availability: null });
});

test("a change the server refuses resolves with the server's own words", async () => {
  convex.approvePlayer.mockRejectedValue(new ConvexError(refusals.notAdmin));
  expect(await seam().approvePlayer(3)).toBe(refusals.notAdmin);
});

test("any other failure is logged and said plainly", async () => {
  const failure = new Error("offline");
  convex.approveClub.mockRejectedValue(failure);
  const logged = silenceConsoleError();

  expect(await seam().approveClub(4)).toBe(changeFailedWords);
  expect(logged).toHaveBeenCalledWith("Approving a club failed:", failure);
});
