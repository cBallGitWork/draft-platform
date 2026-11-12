import { PageSection, Problem } from "../ui/Panel";
import { SectionTab } from "../ui/SectionTabs";
import { BackToLeagues } from "../leagues/LeagueLinks";
import { ADMIN_AVAILABILITY_PATH, ADMIN_FEEDBACK_PATH, ADMIN_FEEDS_PATH, ADMIN_PATH } from "./paths";
import { ADMIN_TITLE, adminTabsLabel, availabilityTabWords, feedbackTabWords, feedsTabWords, positionsTabWords } from "./words";

const TABS = [
  { path: ADMIN_PATH, label: positionsTabWords },
  { path: ADMIN_FEEDS_PATH, label: feedsTabWords },
  { path: ADMIN_FEEDBACK_PATH, label: feedbackTabWords },
  { path: ADMIN_AVAILABILITY_PATH, label: availabilityTabWords },
];

/** The dashboard's title plate over each of its tabs: the tabs, the way back, and why the last
 *  change was refused. Its tabs are routes, so each has its own address. */
export function AdminHeader({ problem = null }: { problem?: string | null }) {
  return (
    <PageSection title={ADMIN_TITLE} className="bg-panel">
      <nav aria-label={adminTabsLabel} className="flex flex-wrap shadow-panel-top">
        {TABS.map((tab) => (
          <SectionTab key={tab.path} path={tab.path}>
            {tab.label}
          </SectionTab>
        ))}
      </nav>
      <p className="px-3 py-2">
        <BackToLeagues />
      </p>
      <Problem problem={problem} />
    </PageSection>
  );
}
