import { PICK_GAP_MS } from "../../../convex/draft/draftClock";
import type { TestConvex } from "./leagues.harness";
import { clockRunsTo } from "./test.harness";

/** The 10 seconds after a pick run out (convex/draft/pickWindow.ts; #1458): its manager can no longer
 *  undo it, the next pick's clock starts, its manager told, or after the last pick the draft ends,
 *  and every job due by then runs. */
export const pickGapPasses = (t: TestConvex): Promise<void> => clockRunsTo(t, Date.now() + PICK_GAP_MS);
