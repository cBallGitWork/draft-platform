// The admin dashboard's tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { AdminSeam, FoundPlayerPositions, PositionsQueue } from "./seam";

/** What the fake server holds: the queue, and who a search finds. */
export type AdminData = { queue?: PositionsQueue; found?: readonly FoundPlayerPositions[] };

export const EMPTY_QUEUE: PositionsQueue = { newSignings: [], waiting: [], clubs: [], approveMode: "proposals" };

/** Every change succeeds, unless a test says otherwise; a search finds `found` for any text. */
export function fakeAdmin({ queue = EMPTY_QUEUE, found = [] }: AdminData = {}) {
  return {
    useQueue: vi.fn<AdminSeam["useQueue"]>(() => queue),
    useFoundPlayers: vi.fn<AdminSeam["useFoundPlayers"]>((text) => (text.trim() ? found : [])),
    approvePlayer: vi.fn<AdminSeam["approvePlayer"]>(async () => null),
    approveClub: vi.fn<AdminSeam["approveClub"]>(async () => null),
    setPosition: vi.fn<AdminSeam["setPosition"]>(async () => null),
    removePosition: vi.fn<AdminSeam["removePosition"]>(async () => null),
    setApproveMode: vi.fn<AdminSeam["setApproveMode"]>(async () => null),
  };
}
