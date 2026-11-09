import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { AuthActions } from "../signIn/seam";
import { FeedbackLink } from "../feedback/FeedbackPage";
import { Continue } from "./topBar/Continue";
import { MAIL_PATH, MY_TEAM_TRANSACTIONS_PATH, sectionAt, sectionsWith } from "./menu";
import { figureWords } from "../shared/words";
import { MainMenu, MenuTab } from "./topBar/MenuTab";
import { TOP_BAR, TOP_BAR_ROW } from "../ui/Panel";
import { ProductName } from "./topBar/ProductName";
import { SignOut } from "./topBar/SignOut";
import type { TopBarState } from "./topBar/topBarState";
import { pendingClaimsTabLabel, sectionTabsLabel } from "./words";

/** A section's tabs, butted like the menu's (plate.md, Shape); the admin's dashboard's too. */
export const sectionTabClasses =
  "flex min-h-tap items-center border-l border-panel-rule px-4 font-semibold text-soft no-underline first:border-l-0 hover:text-fact lg:min-h-subtab " +
  "data-[status=active]:text-fact data-[status=active]:shadow-subtab-active";

/** The signed-in frame: the top menu with the league it is in, Feedback, Continue and Sign out, the
 *  active section's tabs under it, and the page, under the banner, if one shows. The menu holds the
 *  draft room while `draftInMenu`. */
export function AppFrame({
  topBar,
  onSignOut,
  leagueSwitcher,
  banner,
  draftInMenu,
}: {
  topBar: TopBarState;
  onSignOut: AuthActions["signOut"];
  leagueSwitcher: ReactNode;
  banner: ReactNode;
  draftInMenu: boolean;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const tabs = sectionAt(pathname)?.tabs ?? [];

  return (
    <>
      <header className={TOP_BAR}>
        <div className={TOP_BAR_ROW}>
          <ProductName />
          {leagueSwitcher}
          <MainMenu>
            {sectionsWith(draftInMenu).map((section) => (
              <MenuTab
                key={section.path}
                path={section.path}
                label={section.label}
                unreadMail={section.path === MAIL_PATH ? topBar.unreadMail : 0}
              />
            ))}
          </MainMenu>
          <span className="grow" />
          <FeedbackLink />
          <Continue next={topBar.next} />
          <SignOut onSignOut={onSignOut} />
        </div>
        {tabs.length > 0 && (
          <nav aria-label={sectionTabsLabel} className="flex flex-wrap bg-panel shadow-panel-top">
            {tabs.map((tab) => {
              // My team's Transactions tab counts the manager's pending claims (#1200).
              const count = tab.path === MY_TEAM_TRANSACTIONS_PATH ? (topBar.pendingClaims ?? 0) : 0;
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  activeOptions={{ exact: true, includeSearch: false }}
                  className={sectionTabClasses}
                  aria-label={count > 0 ? pendingClaimsTabLabel(tab.label, count) : undefined}
                >
                  {tab.label}
                  {count > 0 && (
                    <span aria-hidden="true" className="ml-1 bg-event px-1 font-bold text-ground">
                      {figureWords(count)}
                    </span>
                  )}
                </Link>
              );
            })}
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
