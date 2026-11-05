// The seam for the draft room (#1098): what the screen reads and asks. Convex fills it in live
// (liveDraft.ts); the preview and the tests hand the screen their own.

import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { BoardPick, DraftBoard } from "../../convex/draft/draftBoard";
import type { GreyedPlayer } from "../../convex/draft/draftPlayers";
import type { ScoutingSeam } from "../scouting/seam";
import type { Change } from "../shared/refusal";

export type { BoardPick, DraftBoard, GreyedPlayer };

/** The league's draft: waiting, live or over (draft/draftStart:ofLeague). */
export type DraftState = FunctionReturnType<typeof api.draft.draftStart.ofLeague>;

/** The picks a manager makes on the draft room. */
export type DraftChanges = {
  /** His team, on the clock, takes the player with this code. */
  makePick(leagueId: Id<"leagues">, playerCode: number): Change;
};

/** The players list is Scouting's (spec/04, The draft room), read the same way. */
export type DraftSeam = Pick<ScoutingSeam, "usePlayersList"> & {
  /** The league's draft at the minute `now`, live (a hook): undefined while it loads. */
  useDraft(leagueId: Id<"leagues">, now: number): DraftState | undefined;
  /** The board's picks, the reader's team and the pick time at the minute `now`, live (a hook):
   *  undefined while they load. */
  useBoard(leagueId: Id<"leagues">, now: number): DraftBoard | undefined;
  /** Whether the draft room is in the menu, live (a hook): undefined while it loads. */
  useInMenu(leagueId: Id<"leagues">): boolean | undefined;
  /** The players the reader's team can't take as its next pick, and why, live (a hook): undefined
   *  while they load. */
  useGreyedOut(leagueId: Id<"leagues">): readonly GreyedPlayer[] | undefined;
  /** The changes the room makes (a hook). */
  useDraftChanges(): DraftChanges;
};
