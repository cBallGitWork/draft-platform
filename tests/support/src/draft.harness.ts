// The draft room's tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ListedPlayer } from "../../../convex/scouting/playersList";
import type { CommissionerChanges, CommissionerView, DraftBoard, DraftChanges, DraftSeam, DraftState, GreyedPlayer, RoomFigures } from "../../../src/draft/seam";
import { fakeScouting } from "./scouting.harness";

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
 *  a test says, so the other screens' menus stay as they are), or nothing yet while it loads; the
 *  players list's players, those the reader's team can't take, and what a pick answers; the
 *  commissioner panel's read, and the words a commissioner's change is refused with. */
export type DraftData = {
  draft?: DraftState;
  board?: DraftBoard;
  inMenu?: boolean;
  loading?: boolean;
  players?: readonly ListedPlayer[];
  greyed?: readonly GreyedPlayer[];
  figures?: RoomFigures;
  /** The reader's queue, by code, first choice first. */
  queue?: readonly number[];
  pickAnswer?: string | null;
  commissioner?: CommissionerView;
  refusal?: string;
};

/** No player ranked, priced or counted, and no club maximum. */
export const noFigures: RoomFigures = { players: [], lastSeason: null, statsSeason: null, maxPerClub: null };

export function fakeDraft({
  draft = waitingDraft,
  board = emptyBoard,
  inMenu = false,
  loading = false,
  players = [],
  greyed = [],
  figures = noFigures,
  queue = [],
  pickAnswer = null,
  commissioner = commissionerView,
  refusal,
}: DraftData = {}) {
  const answer = () => Promise.resolve(refusal ?? null);
  const commissionerChanges = {
    start: vi.fn<CommissionerChanges["start"]>(answer),
    pause: vi.fn<CommissionerChanges["pause"]>(answer),
    resume: vi.fn<CommissionerChanges["resume"]>(answer),
    undo: vi.fn<CommissionerChanges["undo"]>(answer),
    setPickTime: vi.fn<CommissionerChanges["setPickTime"]>(answer),
    markForCommissioner: vi.fn<CommissionerChanges["markForCommissioner"]>(answer),
  };
  const draftChanges = { makePick: vi.fn<DraftChanges["makePick"]>(() => Promise.resolve(pickAnswer)) };
  const changes = { ...draftChanges, ...commissionerChanges };
  return {
    useDraft: vi.fn<DraftSeam["useDraft"]>(() => (loading ? undefined : draft)),
    useBoard: vi.fn<DraftSeam["useBoard"]>(() => (loading ? undefined : board)),
    useInMenu: vi.fn<DraftSeam["useInMenu"]>(() => inMenu),
    usePlayersList: fakeScouting({ players }).usePlayersList,
    useGreyedOut: vi.fn<DraftSeam["useGreyedOut"]>(() => greyed),
    useFigures: vi.fn<DraftSeam["useFigures"]>(() => figures),
    useLists: vi.fn<DraftSeam["useLists"]>(() => ({
      queue: queue.map((code) => ({ ...players.find((each) => each.code === code)!, gone: false })),
      doNotDraft: [],
    })),
    useDraftChanges: () => draftChanges,
    useCommissioner: vi.fn<DraftSeam["useCommissioner"]>(() => commissioner),
    useCommissionerChanges: vi.fn<DraftSeam["useCommissionerChanges"]>(() => commissionerChanges),
    changes,
  };
}
