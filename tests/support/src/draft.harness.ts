// The draft room's tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { CommissionerChanges, CommissionerView, DraftBoard, DraftSeam, DraftState } from "../../../src/draft/seam";

/** Three teams in the draft order, Team 2 the reader's. */
export const draftOrder = ["Team 1", "Team 2", "Team 3"].map((name, index) => ({ teamId: `team-${index + 1}` as Id<"teams">, name }));
export const YOUR_TEAM = draftOrder[1].teamId;

/** A draft of three teams over two rounds, waiting for the commissioner to press start. */
export const waitingDraft: DraftState = { status: "waiting", startsAt: null, rounds: 2, order: draftOrder };

/** No picks yet, the reader's team Team 2, 90 seconds a pick. */
export const emptyBoard: DraftBoard = { picks: [], yourTeamId: YOUR_TEAM, pickSeconds: 90 };

/** What the commissioner panel reads: 90 seconds a pick, and Team 3 with no manager. */
export const commissionerView: CommissionerView = { pickSeconds: 90, unmanaged: [{ teamId: draftOrder[2].teamId, name: draftOrder[2].name, marked: false }] };

/** What the fake server holds: the draft, its board and whether the room is in the menu (not, unless
 *  a test says, so the other screens' menus stay as they are), the commissioner panel's read, and
 *  the words a commissioner's change is refused with, or nothing yet while it loads. */
export type DraftData = { draft?: DraftState; board?: DraftBoard; inMenu?: boolean; loading?: boolean; commissioner?: CommissionerView; refusal?: string };

export function fakeDraft({ draft = waitingDraft, board = emptyBoard, inMenu = false, loading = false, commissioner = commissionerView, refusal }: DraftData = {}) {
  const answer = () => Promise.resolve(refusal ?? null);
  const changes = {
    start: vi.fn<CommissionerChanges["start"]>(answer),
    pause: vi.fn<CommissionerChanges["pause"]>(answer),
    resume: vi.fn<CommissionerChanges["resume"]>(answer),
    undo: vi.fn<CommissionerChanges["undo"]>(answer),
    setPickTime: vi.fn<CommissionerChanges["setPickTime"]>(answer),
    markForCommissioner: vi.fn<CommissionerChanges["markForCommissioner"]>(answer),
  };
  return {
    useDraft: vi.fn<DraftSeam["useDraft"]>(() => (loading ? undefined : draft)),
    useBoard: vi.fn<DraftSeam["useBoard"]>(() => (loading ? undefined : board)),
    useInMenu: vi.fn<DraftSeam["useInMenu"]>(() => inMenu),
    useCommissioner: vi.fn<DraftSeam["useCommissioner"]>(() => commissioner),
    useCommissionerChanges: vi.fn<DraftSeam["useCommissionerChanges"]>(() => changes),
    changes,
  };
}
