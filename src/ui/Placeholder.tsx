import type { ReactNode } from "react";

// A placeholder (plate.md, Marks): data not held yet keeps its place and size, drawn as a 1px muted
// outline, its hover and name saying what will show there; one the size of a panel's lines writes
// that inside, in muted words (Craig, 13 Nov 2026, on #1976), while a small one, a chip or stars,
// stays empty. Never a made-up figure (Craig, 1 Nov 2026: "placeholders, always placeholders").

/** `label` says what will show there ("Role fit: not rated yet"); `className` gives its size and
 *  its place in the caller's layout; `written` writes `label` inside; `children`, where given, is
 *  what is held already (a fixture whose difficulty colour isn't), which `label` then names too. */
export function Placeholder({ label, className, written = false, children }: { label: string; className: string; written?: boolean; children?: ReactNode }) {
  return (
    <span role="img" aria-label={label} title={label} className={`border border-muted ${written ? "flex items-center px-3 py-2 text-muted" : "inline-block"} ${className}`}>
      {written ? <span aria-hidden="true">{label}</span> : children}
    </span>
  );
}
