// The seam for the draft room (#1098): what the screen reads and asks. Convex fills it in live
// (liveDraft.ts); the preview and the tests hand the screen their own.

import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { BoardPick, DraftBoard } from "../../convex/draft/draftBoard";
import type { CommissionerView } from "../../convex/draft/draftCommissioner";
import type { GreyedPlayer, RoomFigure, RoomFigures } from "../../convex/draft/draftPlayers";
import type { ScoutingSeam } from "../scouting/seam";
import type { Change } from "../shared/refusal";

export type { BoardPick, CommissionerView, DraftBoard, GreyedPlayer, RoomFigure, RoomFigures };

/** The league's draft: waiting, live or over (draft/draftStart:ofLeague). */
export type DraftState = FunctionReturnType<typeof api.draft.draftStart.ofLeague>;

/** The reader's queue, first choice first, and do-not-draft list; null for someone who runs no
 *  team (draft/draftLists:mine). */
export type DraftLists = FunctionReturnType<typeof api.draft.draftLists.mine>;

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
  /** Every player's place on the site's ranking, last season's points and the overview's stats,
   *  and the club maximum, at the minute `now`, live (a hook): undefined while they load. */
  useFigures(leagueId: Id<"leagues">, now: number): RoomFigures | undefined;
  /** The reader's queue and do-not-draft list, live (a hook): undefined while they load. */
  useLists(leagueId: Id<"leagues">): DraftLists | undefined;
  /** The changes the room makes (a hook). */
  useDraftChanges(): DraftChanges;
  /** For whoever runs the league only: the commissioner panel's pick time and the teams with no
   *  manager at the minute `now`, live (a hook): undefined while they load. */
  useCommissioner(leagueId: Id<"leagues">, now: number): CommissionerView | undefined;
  /** The commissioner's changes to the draft (a hook). */
  useCommissionerChanges(): CommissionerChanges;
};

/** The commissioner's changes to the league's draft (spec/04, Starting it and The commissioner;
 *  #1101): each resolves with null once made, or the words saying why not. */
export type CommissionerChanges = {
  start(leagueId: Id<"leagues">): Change;
  pause(leagueId: Id<"leagues">): Change;
  resume(leagueId: Id<"leagues">): Change;
  undo(leagueId: Id<"leagues">): Change;
  setPickTime(leagueId: Id<"leagues">, pickSeconds: number): Change;
  /** "I'll pick for" a team with no manager, or, with `marked` false, stop. */
  markForCommissioner(leagueId: Id<"leagues">, teamId: Id<"teams">, marked: boolean): Change;
};
