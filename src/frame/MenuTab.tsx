import { Link } from "@tanstack/react-router";
import { unreadFigure, unreadTabLabel } from "../mail/words";

// Butted tabs with 1px rules between them (plate.md, Shape).
const menuTabClasses =
  "flex min-h-tap items-center border-l border-plate-rule px-4 text-lead font-semibold text-soft no-underline hover:text-fact " +
  "data-[status=active]:text-fact data-[status=active]:shadow-tab-active";

/** A tab on the top bar; Mail's carries its unread count (spec/12). */
export function MenuTab({ path, label, unreadMail = 0 }: { path: string; label: string; unreadMail?: number }) {
  const unread = unreadMail > 0 ? unreadFigure(unreadMail) : null;
  return (
    <Link to={path} className={menuTabClasses} aria-label={unread ? unreadTabLabel(label, unreadMail) : undefined}>
      {label}
      {unread && (
        <span aria-hidden="true" className="ml-1 bg-event px-1 font-bold text-ground">
          {unread}
        </span>
      )}
    </Link>
  );
}
