import { Link } from "@tanstack/react-router";
import { nextGlyph } from "../shared/words";

/** The glyph after a way on ("Player card ›"), hidden from screen readers. A control that isn't a
 *  MoreLink but ends in the same glyph puts it after its words with `gap-1`, as here. */
export function NextGlyph() {
  return <span aria-hidden="true">{nextGlyph}</span>;
}

/** A panel's way on to the screen holding the whole of what it shows: "Matchup ›", "All mail ›",
 *  "Player card ›". One spacing before the glyph everywhere; the caller's classes place it. */
export function MoreLink({
  to,
  search,
  className,
  "aria-label": label,
  children,
}: {
  to: string;
  search?: Record<string, unknown>;
  className?: string;
  "aria-label"?: string;
  children: string;
}) {
  return (
    <Link to={to} search={search} aria-label={label} className={`flex min-h-tap items-center gap-1 font-semibold${className === undefined ? "" : ` ${className}`}`}>
      {children}
      <NextGlyph />
    </Link>
  );
}
