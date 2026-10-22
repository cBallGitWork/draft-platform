import type { ReactNode } from "react";

// The pieces the screens' panels share (plate.md, Shape and Colour roles).

const TITLE_PLATE = "bg-plate px-4 py-1 shadow-bevel-plate";

/** The id of a page's heading, which its section is labelled by. */
export const PAGE_TITLE_ID = "page-title";

/** A page's title plate (plate.md, Shape): the heading its section is labelled by, `PAGE_TITLE_ID`;
 *  `aside`, such as Mail's unread count, sits at the plate's far end. */
export function PageTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  if (aside === undefined) {
    return (
      <h1 id={PAGE_TITLE_ID} className={`${TITLE_PLATE} text-title font-bold`}>
        {children}
      </h1>
    );
  }
  return (
    <div className={`flex items-baseline justify-between ${TITLE_PLATE}`}>
      <h1 id={PAGE_TITLE_ID} className="text-title font-bold">
        {children}
      </h1>
      {aside}
    </div>
  );
}

/** Why the last change was refused, in the alert strip; nothing while there's no problem. */
export function Problem({ problem }: { problem: string | null }) {
  return problem ? (
    <p role="alert" className="alert-strip">
      {problem}
    </p>
  ) : null;
}

/** A panel's title plate (plate.md, Shape). */
export function PanelTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="bg-plate px-3 py-1 text-lead font-bold shadow-bevel-plate">
      {children}
    </h2>
  );
}

/** A muted line saying something is still loading or being searched for, announced to screen
 *  readers; `className` adds the caller's spacing. */
export function Loading({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p role="status" className={className ? `text-muted ${className}` : "text-muted"}>
      {children}
    </p>
  );
}
