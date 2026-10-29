// The seam for the admin's dashboard (#87): what it reads and asks of players' positions, and the
// feeds page's report (#35). Convex fills it in live (liveAdmin.ts); the preview and the tests hand
// the screen their own.

import type { FeedsReport } from "../../convex/admin/feeds";
import type { FoundPlayerPositions, PositionsQueue } from "../../convex/positions/playerPositions";
import type { ChangeThresholds } from "../../convex/positions/positionChanges";
import type { ApproveMode } from "../../convex/positions/positions";
import type { Position } from "../../convex/positions/positionTables";
import type { Change } from "../shared/refusal";

export type { FeedsReport, FoundPlayerPositions, PositionsQueue };

export type AdminSeam = {
  /** The queue, the clubs and the approve mode, live (a hook): undefined while they load. */
  useQueue(): PositionsQueue | undefined;
  /** The players whose name matches `text`, with their positions, live (a hook): undefined while
   *  they load, and none for blank text. */
  useFoundPlayers(text: string): readonly FoundPlayerPositions[] | undefined;
  /** The feeds page's report, judged at the start of the current minute and again at each new
   *  one, live (a hook): undefined while it loads. */
  useFeeds(): FeedsReport | undefined;
  approvePlayer(code: number): Change;
  approveClub(clubCode: number): Change;
  setPosition(code: number, position: Position): Change;
  removePosition(code: number, position: Position): Change;
  setApproveMode(approveMode: ApproveMode): Change;
  setChangeThresholds(thresholds: ChangeThresholds): Change;
};
