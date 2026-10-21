import type { useChange } from "../useChange";
import type { AdminSeam, PositionsQueue } from "./seam";

/** What each of the dashboard's panels is handed: the queue, the seam, and the change under way. */
export type PanelProps = { queue: PositionsQueue; seam: AdminSeam; change: ReturnType<typeof useChange> };
