import { useId } from "react";
import { LEAST_MATCHES_RATED, MOST_STARS, NO_DATA, UNSURE, type Stars } from "../../convex/stars/starsShape";
import { noFigureWords } from "../shared/words";

// A player's stars for a role (plate.md, Marks: Stars; spec/05 Roles): drawn in SVG, filled in the
// figure colour, the empty ones as muted outlines, in half-star steps. Unrated, "?" (fewer than
// LEAST_MATCHES_RATED matches, with a tooltip saying we aren't sure yet) or "—" (no match yet),
// muted (26 Oct 2026). In a box narrower than the set (a lit pitch cell, #11) the stars shrink to
// fit rather than overrun it.

/** One star in a 10-unit square, its points from the top clockwise; the set is five side by side. */
const STAR_POINTS = "5,0.6 6.2,3.8 9.6,3.8 6.9,5.9 7.9,9.3 5,7.3 2.1,9.3 3.1,5.9 0.4,3.8 3.8,3.8";
const STAR_SIZE = 10;
const OFFSETS = Array.from({ length: MOST_STARS }, (_, index) => index * STAR_SIZE);

/** The set's name for screen readers, and the hover: "Role fit 4.5 of 5". */
export const starsLabel = (subject: string, stars: number) => `${subject} ${stars} of ${MOST_STARS}`;
/** "?": he has played too few matches to be sure (spec/05). */
export const unsureGlyph = "?";
export const unsureLabel = (subject: string) => `${subject}: we aren't sure yet, he has played fewer than ${LEAST_MATCHES_RATED} matches`;
export const noDataLabel = (subject: string) => `${subject}: no matches yet`;

/** `subject` names what the stars rate ("Role fit", "Anchor"), for the label and the hover. */
export function StarRating({ stars, subject }: { stars: Stars; subject: string }) {
  const clipId = useId();
  if (stars === UNSURE || stars === NO_DATA) {
    const label = stars === UNSURE ? unsureLabel(subject) : noDataLabel(subject);
    return (
      <span role="img" aria-label={label} title={label} className="font-semibold text-muted">
        {stars === UNSURE ? unsureGlyph : noFigureWords}
      </span>
    );
  }
  const label = starsLabel(subject, stars);
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${MOST_STARS * STAR_SIZE} ${STAR_SIZE}`} className="inline-block h-star w-stars max-w-full shrink-0 align-middle">
      <title>{label}</title>
      <clipPath id={clipId}>
        <rect width={stars * STAR_SIZE} height={STAR_SIZE} />
      </clipPath>
      {OFFSETS.map((x) => (
        <polygon key={x} points={STAR_POINTS} transform={`translate(${x} 0)`} className="fill-none stroke-muted" strokeWidth={0.8} />
      ))}
      <g clipPath={`url(#${clipId})`} data-filled={stars}>
        {OFFSETS.map((x) => (
          <polygon key={x} points={STAR_POINTS} transform={`translate(${x} 0)`} className="fill-figure stroke-figure" strokeWidth={0.8} />
        ))}
      </g>
    </svg>
  );
}
