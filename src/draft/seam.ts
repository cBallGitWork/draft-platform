// The seam for the draft room (#1098): what the screen reads. Convex fills it in live
// (liveDraft.ts); the preview and the tests hand the screen their own.

import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { BoardPick, DraftBoard } from "../../convex/draft/draftBoard";
import type { Change } from "../shared/refusal";

export type { BoardPick, DraftBoard };

/** The league's draft: waiting, live or over (draft/draftStart:ofLeague). */
export type DraftState = FunctionReturnType<typeof api.draft.draftStart.ofLeague>;

export type DraftSeam = {
  /** The league's draft at the minute `now`, live (a hook): undefined while it loads. */
  useDraft(leagueId: Id<"leagues">, now: number): DraftState | undefined;
  /** The board's picks, the reader's team and the pick time at the minute `now`, live (a hook):
   *  undefined while they load. */
  useBoard(leagueId: Id<"leagues">, now: number): DraftBoard | undefined;
  /** Whether the draft room is in the menu, live (a hook): undefined while it loads. */
  useInMenu(leagueId: Id<"leagues">): boolean | undefined;
  /** The reader's own queue and do-not-draft list, live (a hook): undefined while they load, null
   *  for someone who runs no team. */
  useLists(leagueId: Id<"leagues">): DraftLists | null | undefined;
  /** The changes the room's queue, do-not-draft and auto-pick panels make (a hook). */
  useListChanges(): DraftListChanges;
};

/** The reader's queue, first choice first, and do-not-draft list (draft/draftLists:mine). */
export type DraftLists = NonNullable<FunctionReturnType<typeof api.draft.draftLists.mine>>;
export type DraftList = "queue" | "doNotDraft";

/** What adding the whole shortlist did (draft/draftLists:addShortlist). */
export type ShortlistAdded = FunctionReturnType<typeof api.draft.draftLists.addShortlist>;

export type DraftListChanges = {
  remove(leagueId: Id<"leagues">, playerCode: number, list: DraftList): Change;
  /** Moves a queued player to `place`, 1 the top. */
  move(leagueId: Id<"leagues">, playerCode: number, place: number): Change;
  /** "Add my whole shortlist": what it added, or the words saying why not. */
  addShortlist(leagueId: Id<"leagues">): Promise<ShortlistAdded | string>;
  turnOnAutoPick(leagueId: Id<"leagues">): Change;
  takeControlBack(leagueId: Id<"leagues">): Change;
};
