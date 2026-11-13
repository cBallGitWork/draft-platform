import { roleIn } from "../../../../convex/lineup/roles";
import type { RoleRun } from "../../../../convex/scoring/scoringSet";
import type { Starter } from "../lineupEdits";
import { PITCH_SIZE } from "./pitchMarkings";
import type { RowLayout } from "./rowLayout";
import { arrowheadOf, RUN_MARK, runPath, runShows, type PitchPoint } from "./runs";

// Each starter's run on the pitch (spec/05 Runs; #846): a dashed arrow from his place, as old FM
// drew them, his role's (convex/lineup/roles.ts's roleIn) as the site's scoring set holds it
// (`S05.8`; #886) and never drawn here. Under the players' blocks, so it never covers a name. A
// role the set holds no run for holds its place and draws nothing.

const { width, length } = PITCH_SIZE;

/** A run's dashes and gaps, in screen pixels as its stroke doesn't scale. */
const RUN_DASHES = "6 4";
/** A run's line: 2px dashed white however big the pitch is drawn (plate.md, Marks: the pitch). */
const RUN_LINE = { vectorEffect: "non-scaling-stroke", strokeDasharray: RUN_DASHES, className: "fill-none stroke-fact stroke-2" } as const;

const pointsOf = (points: readonly PitchPoint[]) => points.map(({ x, y }) => `${x},${y}`).join(" ");

/** `starters` are who stands where in which role, the Tactics pitch's or a matchup side's; `runs`
 *  are the roles' runs in the site's scoring set; `rows` are how the pitch's rows share its length;
 *  `tapped` is the player picked up or tapped, whose run shows on a phone; `switchedOn` is the
 *  desk's switch. */
export function RoleRuns({
  starters,
  runs,
  rows,
  tapped,
  switchedOn,
}: {
  starters: readonly Starter[];
  runs: readonly RoleRun[];
  rows: RowLayout;
  tapped: number | null;
  switchedOn: boolean;
}) {
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${width} ${length}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
      {starters.map((starter) => {
        const { key } = roleIn(starter, starter.role);
        const run = runs.find(({ role }) => role === key);
        const shows = runShows(starter.playerCode === tapped, switchedOn);
        if (run === undefined || shows === null) return null;
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
