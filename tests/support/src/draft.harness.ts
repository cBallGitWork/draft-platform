// The draft room's tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { DraftBoard, DraftListChanges, DraftLists, DraftSeam, DraftState } from "../../../src/draft/seam";
import { ARSENAL } from "../convex/footballRows.harness";

/** Three teams in the draft order, Team 2 the reader's. */
export const draftOrder = ["Team 1", "Team 2", "Team 3"].map((name, index) => ({ teamId: `team-${index + 1}` as Id<"teams">, name }));
export const YOUR_TEAM = draftOrder[1].teamId;

/** A draft of three teams over two rounds, waiting for the commissioner to press start. */
export const waitingDraft: DraftState = { status: "waiting", startsAt: null, rounds: 2, order: draftOrder };

/** No picks yet, the reader's team Team 2, 90 seconds a pick, off auto-pick with no timeouts of 2. */
export const emptyBoard: DraftBoard = { picks: [], yourTeamId: YOUR_TEAM, pickSeconds: 90, yourAutoPick: { on: false, timeouts: 0, limit: 2 } };

/** A player on the reader's queue or do-not-draft list, as the server sends him. */
export const draftListed = (code: number, name: string): DraftLists["queue"][number] => ({
  code,
  name,
  fullName: name,
  club: ARSENAL,
  ownerTeamName: null,
  gone: false,
  position: "W",
});

/** What the fake server holds: the draft, its board, whether the room is in the menu (not, unless
 *  a test says, so the other screens' menus stay as they are), the reader's lists (null for one who
 *  runs no team), or nothing yet while it loads; and the server's refusal of any change, if it
 *  refuses, and what adding the whole shortlist adds. */
export type DraftData = {
  draft?: DraftState;
  board?: DraftBoard;
  inMenu?: boolean;
  loading?: boolean;
  lists?: DraftLists | null;
  refusal?: string;
  shortlistAdded?: { added: number; leftOut: number };
};

export function fakeDraft({
  draft = waitingDraft,
  board = emptyBoard,
  inMenu = false,
  loading = false,
  lists = { queue: [], doNotDraft: [] },
  refusal,
  shortlistAdded = { added: 0, leftOut: 0 },
}: DraftData = {}) {
  const answer = async () => refusal ?? null;
  const listChanges = {
    remove: vi.fn<DraftListChanges["remove"]>(answer),
    move: vi.fn<DraftListChanges["move"]>(answer),
    addShortlist: vi.fn<DraftListChanges["addShortlist"]>(async () => refusal ?? shortlistAdded),
    turnOnAutoPick: vi.fn<DraftListChanges["turnOnAutoPick"]>(answer),
    takeControlBack: vi.fn<DraftListChanges["takeControlBack"]>(answer),
  };
  return {
    useDraft: vi.fn<DraftSeam["useDraft"]>(() => (loading ? undefined : draft)),
    useBoard: vi.fn<DraftSeam["useBoard"]>(() => (loading ? undefined : board)),
    useInMenu: vi.fn<DraftSeam["useInMenu"]>(() => inMenu),
    useLists: vi.fn<DraftSeam["useLists"]>(() => (loading ? undefined : lists)),
    useListChanges: () => listChanges,
    listChanges,
  };
}
