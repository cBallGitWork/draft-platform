// The seam for the draft room (#1098): what the screen reads. Convex fills it in live
// (liveDraft.ts); the preview and the tests hand the screen their own.

import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { BoardPick, DraftBoard } from "../../convex/draft/draftBoard";

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
};
