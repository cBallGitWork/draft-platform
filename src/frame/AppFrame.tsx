import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { PRODUCT_NAME } from "../product";
import { Continue } from "./Continue";
import { MAIL_PATH, sectionAt, sections } from "./menu";
import type { TopBarState } from "./topBarState";

// Butted tabs with 1px rules between them (plate.md, Shape); the active one is white with a cyan
// underline. Every tab is 44px tall, the phone's target (plate.md, The phone), but a section's
// tabs are 36px on the desk.
const menuTabClasses =
  "flex min-h-tap items-center border-l border-plate-rule px-4 text-lead font-semibold text-soft no-underline hover:text-fact " +
  "data-[status=active]:text-fact data-[status=active]:shadow-tab-active";
const sectionTabClasses =
  "flex min-h-tap items-center border-l border-panel-rule px-4 font-semibold text-soft no-underline first:border-l-0 hover:text-fact lg:min-h-9 " +
  "data-[status=active]:text-fact data-[status=active]:shadow-subtab-active";

/** The signed-in frame: the top menu, the active section's tabs under it, and the page. */
export function AppFrame({ topBar }: { topBar: TopBarState }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const tabs = sectionAt(pathname)?.tabs ?? [];
  const unread = topBar.unreadMail > 0 ? topBar.unreadMail : null;

  return (
    <>
      <header className="bg-plate shadow-bevel-plate">
        <div className="flex flex-wrap items-stretch">
          <span className="flex min-h-tap items-center px-4 text-lead font-bold">{PRODUCT_NAME}</span>
          {/* On a phone the menu takes its own row under the name and Continue. */}
          <nav
            aria-label="Main"
            className="order-last flex w-full flex-wrap border-t border-plate-rule lg:order-none lg:w-auto lg:border-t-0 lg:border-r"
          >
            {sections.map((section) => {
              const isMail = section.path === MAIL_PATH;
              return (
                <Link
                  key={section.path}
                  to={section.path}
                  className={menuTabClasses}
                  aria-label={isMail && unread ? `Mail, ${unread} unread` : undefined}
                >
                  {section.label}
                  {isMail && unread && (
                    <span aria-hidden="true" className="ml-1 bg-event px-1 font-bold text-ground">
                      {unread}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <span className="grow" />
          <Continue next={topBar.next} />
        </div>
        {tabs.length > 0 && (
          <nav aria-label="Section" className="flex flex-wrap bg-panel shadow-panel-top">
            {tabs.map((tab) => (
              <Link key={tab.path} to={tab.path} activeOptions={{ exact: true, includeSearch: false }} className={sectionTabClasses}>
                {tab.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main className="p-2">
        <Outlet />
      </main>
    </>
  );
}
