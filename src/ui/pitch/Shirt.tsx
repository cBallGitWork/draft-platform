import { useId } from "react";
import { kitOf, type Ink } from "../../../convex/football/clubColours";
import { useClubColours } from "../../shared/clubColours";

/** A shirt's number and outline, in the ink that reads on its colour: either ink stands out on both
 *  stripes of the grass too, so a white or a dark kit keeps its edge. */
const INK_CLASSES: Record<Ink, string> = { dark: "fill-ground stroke-ground", light: "fill-fact stroke-fact" };

/** On a patterned shirt the number crosses both colours, so it gets an outline in the other ink
 *  (spec/12, Club colours), drawn under its fill (`paintOrder`). */
const OUTLINE_CLASSES: Record<Ink, string> = { dark: "stroke-fact", light: "stroke-ground" };

/** The shirt's outline, in its own 40-unit box. */
const SHIRT_PATH = "M13 4 L7 7 L2 13 L7 18 L10 16 L10 37 L30 37 L30 16 L33 18 L38 13 L33 7 L27 4 Q20 10 13 4 Z";

/** A striped shirt's trim stripes: 4 wide, 8 apart, one down the middle under the number. */
const STRIPES_AT = [2, 10, 18, 26, 34];
const STRIPE_WIDTH = 4;

/** Our own shirt outline in his club's colours and pattern (plate.md, Marks; a keeper in its
 *  second colour, plain), with his squad number on it once his manager gives him one (#13). The
 *  colour is only a look: his name says who he is, so screen readers skip the shirt. `size` is its
 *  size class: the pitch draws it a little bigger, the matchup's tile bigger still. */
export function Shirt({ number, clubCode, goalkeeper, size = "size-shirt" }: { number: number | null; clubCode: number | null; goalkeeper: boolean; size?: string }) {
  const kit = kitOf(useClubColours()(clubCode), goalkeeper);
  const striped = kit.pattern === "stripes";
  const clipId = useId();
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={`${size} shrink-0 ${INK_CLASSES[kit.ink]}`}>
      <path style={{ fill: kit.shirt }} d={SHIRT_PATH} />
      {striped && (
        <>
          <clipPath id={clipId}>
            <path d={SHIRT_PATH} />
          </clipPath>
          <g clipPath={`url(#${clipId})`} className="stroke-none" style={{ fill: kit.trim }}>
            {STRIPES_AT.map((x) => (
              <rect key={x} x={x} y="0" width={STRIPE_WIDTH} height="40" />
            ))}
          </g>
          {/* The edge again, over the stripes' ends. */}
          <path style={{ fill: "none" }} d={SHIRT_PATH} />
        </>
      )}
      {number !== null && (
        // In the shirt's own units, as the shirt is drawn 40 wide and shown smaller (size-shirt).
        <text
          x="20"
          y="29"
          textAnchor="middle"
          fontSize="14"
          strokeWidth="3"
          strokeLinejoin="round"
          paintOrder="stroke"
          className={`font-bold ${striped ? OUTLINE_CLASSES[kit.ink] : "stroke-none"}`}
        >
          {number}
        </text>
      )}
    </svg>
  );
}
