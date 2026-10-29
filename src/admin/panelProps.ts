import type { Changing } from "../shared/useChange";
import type { AdminSeam, PositionsQueue } from "./seam";

/** What each of the dashboard's panels is handed: the queue, the seam, and the change under way. */
export type PanelProps = { queue: PositionsQueue; seam: AdminSeam; change: Changing };
