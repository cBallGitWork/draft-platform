import { Link } from "@tanstack/react-router";
import { sectionTabClasses } from "../frame/AppFrame";
import { PAGE_TITLE_ID, PageTitle, Problem } from "../frame/Panel";
import { BackToLeagues } from "../leagues/LeagueLinks";
import { ADMIN_FEEDS_PATH, ADMIN_PATH } from "./paths";
import { ADMIN_TITLE, adminTabsLabel, feedsTabWords, positionsTabWords } from "./words";

const TABS = [
  { path: ADMIN_PATH, label: positionsTabWords },
  { path: ADMIN_FEEDS_PATH, label: feedsTabWords },
];

/** The dashboard's title plate over each of its tabs: the tabs, the way back, and why the last
 *  change was refused. Its tabs are routes, so each has its own address. */
export function AdminHeader({ problem = null }: { problem?: string | null }) {
  return (
    <section aria-labelledby={PAGE_TITLE_ID} className="bg-panel">
      <PageTitle>{ADMIN_TITLE}</PageTitle>
      <nav aria-label={adminTabsLabel} className="flex flex-wrap shadow-panel-top">
        {TABS.map((tab) => (
          <Link key={tab.path} to={tab.path} activeOptions={{ exact: true, includeSearch: false }} className={sectionTabClasses}>
            {tab.label}
          </Link>
        ))}
      </nav>
      <p className="px-3 py-2">
        <BackToLeagues />
      </p>
      <Problem problem={problem} />
    </section>
  );
}
