import { roleIn, slotLabel, SWEEPER } from "../../../convex/lineup/roles";
import type { DraftLineup } from "./lineupDraft";
import { PITCH_SIZE } from "./pitchMarkings";
import { arrowheadOf, RUN_HEAD_MARK, RUN_MARK, runPath, runShows, type PitchPoint } from "./runs";

// Each starter's run on the pitch (spec/05 Runs; #846): a dashed arrow from his place, as old FM
// drew them, read from his role (convex/lineup/roles.ts) and never drawn here. A role that holds
// its place draws nothing. Drawn in two parts: the lines under the players' blocks, so none covers
// a name, and the arrowheads over them, so a run ending at the next row's player still shows
// where it goes.

const { width, length } = PITCH_SIZE;

/** A run's dashes and gaps, in screen pixels as its stroke doesn't scale. */
const RUN_DASHES = "6 4";
/** A run's line: 2px dashed white however big the pitch is drawn (plate.md, Marks: A role's run). */
const RUN_LINE = { vectorEffect: "non-scaling-stroke", strokeDasharray: RUN_DASHES, className: "fill-none stroke-fact stroke-2" } as const;
/** An arrowhead: solid white, edged in the ground's ink so it stands out on a white shirt too. */
const RUN_HEAD = { vectorEffect: "non-scaling-stroke", className: "fill-fact stroke-ground stroke-1" } as const;

/** Which part a drawing holds, and what stacks it: the lines under the blocks, the heads over
 *  them, and over a sweeper's cell too (pitch.css). */
const PARTS = {
  lines: { mark: RUN_MARK, stack: "" },
  heads: { mark: RUN_HEAD_MARK, stack: "z-10" },
} as const;

const pointsOf = (points: readonly PitchPoint[]) => points.map(({ x, y }) => `${x},${y}`).join(" ");

/** `tapped` is the player picked up, whose run shows on a phone; `switchedOn` is the desk's switch. */
export function RoleRuns({ draft, tapped, switchedOn, part }: { draft: DraftLineup; tapped: number | null; switchedOn: boolean; part: keyof typeof PARTS }) {
  const { mark, stack } = PARTS[part];
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${width} ${length}`} preserveAspectRatio="none" className={`pointer-events-none absolute inset-0 size-full ${stack}`}>
      {draft.starters.map((starter) => {
        const { run } = roleIn(starter, starter.role);
        const shows = runShows(starter.playerCode === tapped, switchedOn);
        if (run === null || shows === null) return null;
        const path = runPath(run, starter, slotLabel(starter, starter.role) === SWEEPER);
        return (
          <g key={starter.playerCode} {...{ [mark]: starter.playerCode }} className={shows}>
            {part === "lines" ? <polyline points={pointsOf(path)} {...RUN_LINE} /> : <polygon points={pointsOf(arrowheadOf(path))} {...RUN_HEAD} />}
          </g>
        );
      })}
    </svg>
  );
}
