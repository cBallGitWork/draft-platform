import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { AuthActions } from "../auth";
import { FeedbackLink } from "../feedback/FeedbackPage";
import { Continue } from "./Continue";
import { MAIL_PATH, sectionAt, sections } from "./menu";
import { MenuTab } from "./MenuTab";
import { TOP_BAR, TOP_BAR_ROW } from "./Panel";
import { ProductName } from "./ProductName";
import { SignOut } from "./SignOut";
import type { TopBarState } from "./topBarState";
import { mainMenuLabel, sectionTabsLabel } from "./words";

/** A section's tabs, butted like the menu's (plate.md, Shape); the admin's dashboard's too. */
export const sectionTabClasses =
  "flex min-h-tap items-center border-l border-panel-rule px-4 font-semibold text-soft no-underline first:border-l-0 hover:text-fact lg:min-h-subtab " +
  "data-[status=active]:text-fact data-[status=active]:shadow-subtab-active";

/** The signed-in frame: the top menu with the league it is in, Feedback, Continue and Sign out, the
 *  active section's tabs under it, and the page, under the banner, if one shows. */
export function AppFrame({
  topBar,
  onSignOut,
  leagueSwitcher,
  banner,
}: {
  topBar: TopBarState;
  onSignOut: AuthActions["signOut"];
  leagueSwitcher: ReactNode;
  banner: ReactNode;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const tabs = sectionAt(pathname)?.tabs ?? [];

  return (
    <>
      <header className={TOP_BAR}>
        <div className={TOP_BAR_ROW}>
          <ProductName />
          {leagueSwitcher}
          {/* On a phone the menu takes its own row under the name, Continue and Sign out. */}
          <nav
            aria-label={mainMenuLabel}
            className="order-last flex w-full flex-wrap border-t border-plate-rule lg:order-none lg:w-auto lg:border-t-0 lg:border-r"
          >
            {sections.map((section) => (
              <MenuTab
                key={section.path}
                path={section.path}
                label={section.label}
                unreadMail={section.path === MAIL_PATH ? topBar.unreadMail : 0}
              />
            ))}
          </nav>
          <span className="grow" />
          <FeedbackLink />
          <Continue next={topBar.next} />
          <SignOut onSignOut={onSignOut} />
        </div>
        {tabs.length > 0 && (
          <nav aria-label={sectionTabsLabel} className="flex flex-wrap bg-panel shadow-panel-top">
            {tabs.map((tab) => (
              <Link key={tab.path} to={tab.path} activeOptions={{ exact: true, includeSearch: false }} className={sectionTabClasses}>
                {tab.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main className="p-2">
        {banner}
        <Outlet />
      </main>
    </>
  );
}
