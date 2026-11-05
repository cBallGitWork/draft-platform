// The draft room's tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { DraftBoard, DraftSeam, DraftState } from "../../../src/draft/seam";

/** Three teams in the draft order, Team 2 the reader's. */
export const draftOrder = ["Team 1", "Team 2", "Team 3"].map((name, index) => ({ teamId: `team-${index + 1}` as Id<"teams">, name }));
export const YOUR_TEAM = draftOrder[1].teamId;

/** A draft of three teams over two rounds, waiting for the commissioner to press start. */
export const waitingDraft: DraftState = { status: "waiting", startsAt: null, rounds: 2, order: draftOrder };

/** No picks yet, the reader's team Team 2, 90 seconds a pick. */
export const emptyBoard: DraftBoard = { picks: [], yourTeamId: YOUR_TEAM, pickSeconds: 90 };

/** What the fake server holds: the draft, its board and whether the room is in the menu (not, unless
 *  a test says, so the other screens' menus stay as they are), or nothing yet while it loads. */
export type DraftData = { draft?: DraftState; board?: DraftBoard; inMenu?: boolean; loading?: boolean };

export function fakeDraft({ draft = waitingDraft, board = emptyBoard, inMenu = false, loading = false }: DraftData = {}) {
  return {
    useDraft: vi.fn<DraftSeam["useDraft"]>(() => (loading ? undefined : draft)),
    useBoard: vi.fn<DraftSeam["useBoard"]>(() => (loading ? undefined : board)),
    useInMenu: vi.fn<DraftSeam["useInMenu"]>(() => inMenu),
  };
}
