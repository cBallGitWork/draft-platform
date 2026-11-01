import type { ReactNode } from "react";

// A placeholder (plate.md, Marks): data not held yet keeps its place and size, drawn as a 1px muted
// outline with nothing in it, its hover and name saying what will show there. Never a made-up
// figure (Craig, 1 Nov 2026: "placeholders, always placeholders").

/** `label` says what will show there ("Role fit: not rated yet"); `className` gives its size and
 *  its place in the caller's layout; `children`, where given, is what is held already (a fixture
 *  whose difficulty colour isn't), which `label` then names too. */
export function Placeholder({ label, className, children }: { label: string; className: string; children?: ReactNode }) {
  return (
    <span role="img" aria-label={label} title={label} className={`inline-block border border-muted ${className}`}>
      {children}
    </span>
  );
}
