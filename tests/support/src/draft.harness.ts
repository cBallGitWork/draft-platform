// The draft room's tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ListedPlayer } from "../../../convex/scouting/playersList";
import type { CommissionerChanges, CommissionerView, DraftBoard, DraftChanges, DraftListChanges, DraftLists, DraftSeam, DraftState, GreyedPlayer, RoomFigures } from "../../../src/draft/seam";
import { ARSENAL } from "../convex/footballRows.harness";
import { fakeScouting } from "./scouting.harness";

/** Three teams in the draft order, Team 2 the reader's. */
export const draftOrder = ["Team 1", "Team 2", "Team 3"].map((name, index) => ({ teamId: `team-${index + 1}` as Id<"teams">, name }));
export const YOUR_TEAM = draftOrder[1].teamId;

/** A draft of three teams over two rounds, waiting for the commissioner to press start. */
export const waitingDraft: DraftState = { status: "waiting", startsAt: null, rounds: 2, order: draftOrder };

/** No picks yet or traded, the reader's team Team 2, 90 seconds a pick, off auto-pick with no
 *  timeouts of 2. */
export const emptyBoard: DraftBoard = { picks: [], yourTeamId: YOUR_TEAM, pickSeconds: 90, yourAutoPick: { on: false, timeouts: 0, limit: 2 }, tradedPicks: [] };

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

/** What the commissioner panel reads: 90 seconds a pick, and Team 3 with no manager. */
export const commissionerView: CommissionerView = { pickSeconds: 90, unmanaged: [{ teamId: draftOrder[2].teamId, name: draftOrder[2].name, marked: false }] };

/** What the fake server holds: the draft, its board and whether the room is in the menu (not, unless
 *  a test says, so the other screens' menus stay as they are), or nothing yet while it loads; the
 *  players list's players, those the reader's team can't take, and what a pick answers; the
 *  reader's lists (null for one who runs no team), or else his queue by code from `players`; the
 *  server's refusal of any list or commissioner's change, if it refuses, and what adding the whole
 *  shortlist adds; and the commissioner panel's read. */
export type DraftData = {
  draft?: DraftState;
  board?: DraftBoard;
  inMenu?: boolean;
  loading?: boolean;
  players?: readonly ListedPlayer[];
  greyed?: readonly GreyedPlayer[];
  figures?: RoomFigures;
  /** The reader's queue, by code, first choice first, when `lists` isn't given. */
  queue?: readonly number[];
  pickAnswer?: string | null;
  lists?: DraftLists | null;
  refusal?: string;
  shortlistAdded?: { added: number; leftOut: number };
  commissioner?: CommissionerView;
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
  lists,
  refusal,
  shortlistAdded = { added: 0, leftOut: 0 },
  commissioner = commissionerView,
}: DraftData = {}) {
  const answer = async () => refusal ?? null;
  const draftChanges = { makePick: vi.fn<DraftChanges["makePick"]>(() => Promise.resolve(pickAnswer)) };
  const commissionerChanges = {
    start: vi.fn<CommissionerChanges["start"]>(answer),
    pause: vi.fn<CommissionerChanges["pause"]>(answer),
    resume: vi.fn<CommissionerChanges["resume"]>(answer),
    undo: vi.fn<CommissionerChanges["undo"]>(answer),
    setPickTime: vi.fn<CommissionerChanges["setPickTime"]>(answer),
    markForCommissioner: vi.fn<CommissionerChanges["markForCommissioner"]>(answer),
  };
  const changes = { ...draftChanges, ...commissionerChanges };
  const listChanges = {
    add: vi.fn<DraftListChanges["add"]>(answer),
    remove: vi.fn<DraftListChanges["remove"]>(answer),
    move: vi.fn<DraftListChanges["move"]>(answer),
    addShortlist: vi.fn<DraftListChanges["addShortlist"]>(async () => refusal ?? shortlistAdded),
    turnOnAutoPick: vi.fn<DraftListChanges["turnOnAutoPick"]>(answer),
    takeControlBack: vi.fn<DraftListChanges["takeControlBack"]>(answer),
  };
  const yourLists: DraftLists | null =
    lists !== undefined
      ? lists
      : {
          queue: queue.map((code) => {
            const player = players.find((each) => each.code === code)!;
            return { ...player, gone: false, position: player.positions[0] ?? null };
          }),
          doNotDraft: [],
        };
  return {
    useDraft: vi.fn<DraftSeam["useDraft"]>(() => (loading ? undefined : draft)),
    useBoard: vi.fn<DraftSeam["useBoard"]>(() => (loading ? undefined : board)),
    useInMenu: vi.fn<DraftSeam["useInMenu"]>(() => inMenu),
    usePlayersList: fakeScouting({ players }).usePlayersList,
    useGreyedOut: vi.fn<DraftSeam["useGreyedOut"]>(() => greyed),
    useFigures: vi.fn<DraftSeam["useFigures"]>(() => figures),
    useLists: vi.fn<DraftSeam["useLists"]>(() => (loading ? undefined : yourLists)),
    useDraftChanges: () => draftChanges,
    useCommissioner: vi.fn<DraftSeam["useCommissioner"]>(() => commissioner),
    useCommissionerChanges: vi.fn<DraftSeam["useCommissionerChanges"]>(() => commissionerChanges),
    changes,
    useListChanges: () => listChanges,
    listChanges,
  };
}
