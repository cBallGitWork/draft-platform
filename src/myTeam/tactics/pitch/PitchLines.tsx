import {
  CENTRE_SPOT,
  CIRCLE_RADIUS,
  CORNER_ARC_RADIUS,
  END_MARKINGS,
  PITCH_SIZE,
  SPOT_DRAWN_RADIUS,
} from "./pitchMarkings";
import { EVEN_ROWS, ROWS_DRAWN, type RowLayout } from "./rowLayout";

// The grass and the markings behind the pitch's cells, drawn in metres (./pitchMarkings.ts) on a
// box the pitch's own shape, so every line is to scale at any width (plate.md, Marks: the pitch).

const { width, length } = PITCH_SIZE;
const { penaltyArea, goalArea, penaltySpot, arcHalfWidth } = END_MARKINGS;
/** Every line's look: 2px however big the pitch is drawn. */
const LINE = { vectorEffect: "non-scaling-stroke", className: "fill-none stroke-pitch-line stroke-2" } as const;

/** The half turn that draws the bottom end from the top one. */
const OTHER_END = `rotate(180 ${CENTRE_SPOT.x} ${CENTRE_SPOT.y})`;

/** A box's outline, or a spot, in metres. */
const Box = (box: { x: number; y: number; width: number; height: number }) => <rect {...box} {...LINE} />;
const Spot = ({ x, y }: { x: number; y: number }) => <circle cx={x} cy={y} r={SPOT_DRAWN_RADIUS} className="fill-pitch-line" />;

/** One end, the top: its boxes, the spot, the D outside the penalty area, and its two corner arcs. */
function End() {
  const front = penaltyArea.height;
  const arc = `M ${penaltySpot.x - arcHalfWidth} ${front} A ${CIRCLE_RADIUS} ${CIRCLE_RADIUS} 0 0 0 ${penaltySpot.x + arcHalfWidth} ${front}`;
  const radius = CORNER_ARC_RADIUS;
  const corners = `M 0 ${radius} A ${radius} ${radius} 0 0 0 ${radius} 0 M ${width - radius} 0 A ${radius} ${radius} 0 0 0 ${width} ${radius}`;
  return (
    <>
      <Box {...penaltyArea} />
      <Box {...goalArea} />
      <Spot {...penaltySpot} />
      <path d={arc} {...LINE} />
      <path d={corners} {...LINE} />
    </>
  );
}

/** `rows` are how the players' rows share the length, which the stripes follow; the markings stay
 *  to scale whatever they are. */
export function PitchLines({ rows = EVEN_ROWS }: { rows?: RowLayout }) {
  const shown = ROWS_DRAWN.flatMap((area, row) => (rows.heights[row] > 0 ? [{ area, top: rows.tops[row], height: rows.heights[row] }] : []));
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${length}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 size-full"
    >
      {/* A stripe to each row the players stand in. */}
      {shown.map(({ area, top, height }, row) => (
        <rect key={area} x={0} y={top} width={width} height={height} className={row % 2 === 0 ? "fill-pitch" : "fill-pitch-stripe"} />
      ))}
      <line x1={0} y1={CENTRE_SPOT.y} x2={width} y2={CENTRE_SPOT.y} {...LINE} />
      <circle cx={CENTRE_SPOT.x} cy={CENTRE_SPOT.y} r={CIRCLE_RADIUS} {...LINE} />
      <Spot {...CENTRE_SPOT} />
      <End />
      <g transform={OTHER_END}>
        <End />
      </g>
    </svg>
  );
}
