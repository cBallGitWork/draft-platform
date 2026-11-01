// A placeholder (plate.md, Marks): data not held yet keeps its place and size, drawn as a 1px muted
// outline with nothing in it, its hover and name saying what will show there. Never a made-up
// figure (Craig, 1 Nov 2026: "placeholders, always placeholders").

/** `label` says what will show there ("Role fit: not rated yet"); `className` gives its size and
 *  its place in the caller's layout. */
export function Placeholder({ label, className }: { label: string; className: string }) {
  return <span role="img" aria-label={label} title={label} className={`inline-block border border-muted ${className}`} />;
}
