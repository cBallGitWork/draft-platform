// The admin dashboard's tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import { FIRST_THRESHOLDS } from "../../../convex/positions/positionChanges";
import type { AdminSeam, FeedsReport, FoundPlayerPositions, PositionsQueue } from "../../../src/admin/seam";

/** What the fake server holds: the queue, who a search finds, and the feeds page's report
 *  (undefined: still loading). */
export type AdminData = {
  queue?: PositionsQueue;
  found?: readonly FoundPlayerPositions[];
  feeds?: FeedsReport;
  loading?: boolean;
  searching?: boolean;
};

export const EMPTY_QUEUE: PositionsQueue = {
  newSignings: [],
  waiting: [],
  flagged: [],
  removed: [],
  clubs: [],
  approveMode: "proposals",
  thresholds: FIRST_THRESHOLDS,
};

/** Every change succeeds, unless a test says otherwise; a search finds `found` for any text.
 *  `loading` keeps the queue, and `searching` a search, still on their way (undefined). */
export function fakeAdmin({ queue = EMPTY_QUEUE, found = [], feeds, loading = false, searching = false }: AdminData = {}) {
  return {
    useQueue: vi.fn<AdminSeam["useQueue"]>(() => (loading ? undefined : queue)),
    useFoundPlayers: vi.fn<AdminSeam["useFoundPlayers"]>((text) => (searching ? undefined : text.trim() ? found : [])),
    useFeeds: vi.fn<AdminSeam["useFeeds"]>(() => feeds),
    approvePlayer: vi.fn<AdminSeam["approvePlayer"]>(async () => null),
    approveClub: vi.fn<AdminSeam["approveClub"]>(async () => null),
    setPosition: vi.fn<AdminSeam["setPosition"]>(async () => null),
    removePosition: vi.fn<AdminSeam["removePosition"]>(async () => null),
    setApproveMode: vi.fn<AdminSeam["setApproveMode"]>(async () => null),
    setChangeThresholds: vi.fn<AdminSeam["setChangeThresholds"]>(async () => null),
  };
}
