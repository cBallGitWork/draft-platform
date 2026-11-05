// The seam for the draft room (#1098): what the screen reads. Convex fills it in live
// (liveDraft.ts); the preview and the tests hand the screen their own.

import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { BoardPick, DraftBoard } from "../../convex/draft/draftBoard";
import type { CommissionerView } from "../../convex/draft/draftCommissioner";
import type { Change } from "../shared/refusal";

export type { BoardPick, CommissionerView, DraftBoard };

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
