import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { unreadFigure, unreadTabLabel } from "../mail/words";
import { mainMenuLabel } from "./words";

// On a phone the menu takes its own row under the name and Sign out (and Continue, in a league).
const mainMenuClasses = "order-last flex w-full flex-wrap border-t border-plate-rule lg:order-none lg:w-auto lg:border-t-0 lg:border-r";

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

/** The top bar's menu of tabs, named for screen readers: a league's sections, or, in no league,
 *  their leagues and Mail. */
export function MainMenu({ children }: { children: ReactNode }) {
  return (
    <nav aria-label={mainMenuLabel} className={mainMenuClasses}>
      {children}
    </nav>
  );
}
