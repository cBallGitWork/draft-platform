import { Link } from "@tanstack/react-router";

/** A League home panel's way on to the page that holds all of what it shows, with that page's
 *  search where it has one (Read the recap's gameweek). */
export function PanelLink({ to, search, children }: { to: string; search?: Record<string, unknown>; children: string }) {
  return (
    <Link to={to} search={search} className="flex min-h-tap items-center px-3">
      {children}
    </Link>
  );
}
