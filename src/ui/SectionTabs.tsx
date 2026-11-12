import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** A section's tabs, butted like the menu's (plate.md, Shape): the frame's, the admin's
 *  dashboard's and Scoring's. The active one is the one marked `data-status="active"`, as a Link
 *  marks itself. */
export const sectionTabClasses =
  "flex min-h-tap items-center border-l border-panel-rule px-4 font-semibold text-soft no-underline first:border-l-0 hover:text-fact lg:min-h-subtab " +
  "data-[status=active]:text-fact data-[status=active]:shadow-subtab-active";

/** One section tab that is a route, active on its own address alone. */
export function SectionTab({ path, label, children }: { path: string; label?: string; children: ReactNode }) {
  return (
    <Link to={path} activeOptions={{ exact: true, includeSearch: false }} className={sectionTabClasses} aria-label={label}>
      {children}
    </Link>
  );
}

/** A count after a tab's name, such as unread mail or pending claims, in the event colour
 *  (Colour roles: event); the tab's own label says it for screen readers. */
export function CountBadge({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="ml-1 bg-event px-1 font-bold text-ground">
      {children}
    </span>
  );
}
