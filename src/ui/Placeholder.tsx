// Data not held yet, in its real place and size (plate.md, Marks: a placeholder): a 1px muted
// outline with nothing in it, its `title` and label saying what will show there. Never a made-up
// figure (Craig, 1 Nov 2026: "placeholders, always placeholders").

import type { ReactNode } from "react";

/** An empty outlined box; `className` gives its size and its place in the caller's layout, and
 *  `children`, where given, is what is held already (a fixture whose difficulty colour isn't). */
export function Placeholder({ label, className, children }: { label: string; className?: string; children?: ReactNode }) {
  return (
    <span role="img" aria-label={label} title={label} className={`inline-block border border-muted ${className ?? ""}`}>
      {children}
    </span>
  );
}
