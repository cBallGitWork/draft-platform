// The seam for the admin's dashboard (#87): what it reads and asks of players' positions. Convex
// fills it in live (liveAdmin.ts); the preview and the tests hand the screen their own.

import type { FoundPlayerPositions, PositionsQueue } from "../../convex/playerPositions";
import type { ApproveMode } from "../../convex/positions";
import type { Position } from "../../convex/positionTables";

export type { FoundPlayerPositions, PositionsQueue };

/** A change: it resolves with null once made, or with the words saying why not. It never rejects. */
type Change = Promise<string | null>;

export type AdminSeam = {
  /** The queue, the clubs and the approve mode, live (a hook): undefined while they load. */
  useQueue(): PositionsQueue | undefined;
  /** The players whose name matches `text`, with their positions, live (a hook): undefined while
   *  they load, and none for blank text. */
  useFoundPlayers(text: string): readonly FoundPlayerPositions[] | undefined;
  approvePlayer(code: number): Change;
  approveClub(clubCode: number): Change;
  setPosition(code: number, position: Position): Change;
  removePosition(code: number, position: Position): Change;
  setApproveMode(approveMode: ApproveMode): Change;
};
