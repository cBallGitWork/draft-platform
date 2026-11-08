import { roleIn } from "../../../../convex/lineup/roles";
import type { EditedLineup } from "../lineupEdits";
import { PITCH_SIZE } from "./pitchMarkings";
import type { RowLayout } from "./rowLayout";
import { arrowheadOf, RUN_MARK, runPath, runShows, type PitchPoint } from "./runs";

// Each starter's run on the pitch (spec/05 Runs; #846): a dashed arrow from his place, as old FM
// drew them, read from his role (convex/lineup/roles.ts) and never drawn here. Under the players'
// blocks, so it never covers a name. A role that holds its place draws nothing.

const { width, length } = PITCH_SIZE;

/** A run's dashes and gaps, in screen pixels as its stroke doesn't scale. */
const RUN_DASHES = "6 4";
/** A run's line: 2px dashed white however big the pitch is drawn (plate.md, Marks: the pitch). */
const RUN_LINE = { vectorEffect: "non-scaling-stroke", strokeDasharray: RUN_DASHES, className: "fill-none stroke-fact stroke-2" } as const;

const pointsOf = (points: readonly PitchPoint[]) => points.map(({ x, y }) => `${x},${y}`).join(" ");

/** `rows` are how the pitch's rows share its length; `tapped` is the player picked up, whose run
 *  shows on a phone; `switchedOn` is the desk's switch. */
export function RoleRuns({ draft, rows, tapped, switchedOn }: { draft: EditedLineup; rows: RowLayout; tapped: number | null; switchedOn: boolean }) {
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${width} ${length}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
      {draft.starters.map((starter) => {
        const { run } = roleIn(starter, starter.role);
        const shows = runShows(starter.playerCode === tapped, switchedOn);
        if (run === null || shows === null) return null;
        const path = runPath(run, starter, rows);
        return (
          <g key={starter.playerCode} {...{ [RUN_MARK]: starter.playerCode }} className={shows}>
            <polyline points={pointsOf(path)} {...RUN_LINE} />
            <polygon points={pointsOf(arrowheadOf(path))} className="fill-fact" />
          </g>
        );
      })}
    </svg>
  );
}
