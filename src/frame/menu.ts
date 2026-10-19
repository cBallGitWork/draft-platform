// The top menu and each section's second row of tabs (spec/12-screens.md, "The frame").
// The sections are the screens spec/12 lists, in R3·1's order (docs/design/mockups/PlateOne.dc.html),
// with the Premier League as its own section (spec/18). My team's tabs are R3·1's; a section
// gets tabs when its screen is grilled, and until then has no second row.

export type Page = { label: string; path: string };
export type Section = Page & { tabs: readonly Page[] };

export const MY_TEAM_PATH = "/team";
export const MAIL_PATH = "/mail";

export const sections: readonly Section[] = [
  { label: "Home", path: "/home", tabs: [] },
  {
    label: "My team",
    path: MY_TEAM_PATH,
    tabs: [
      { label: "Tactics", path: MY_TEAM_PATH },
      { label: "Squad", path: `${MY_TEAM_PATH}/squad` },
      { label: "Fixtures", path: `${MY_TEAM_PATH}/fixtures` },
      { label: "Transactions", path: `${MY_TEAM_PATH}/transactions` },
    ],
  },
  { label: "Matchup", path: "/matchup", tabs: [] },
  { label: "Table", path: "/table", tabs: [] },
  { label: "Players", path: "/players", tabs: [] },
  { label: "Trades", path: "/trades", tabs: [] },
  { label: "Premier League", path: "/premier-league", tabs: [] },
  { label: "Mail", path: MAIL_PATH, tabs: [] },
];

export function sectionAt(pathname: string): Section | undefined {
  return sections.find((s) => pathname === s.path || pathname.startsWith(`${s.path}/`));
}

/** Every page the menu reaches: each section, and each tab that isn't its section's own page. */
export const pages: readonly Page[] = sections.flatMap((section) => [
  { label: section.label, path: section.path },
  ...section.tabs.filter((tab) => tab.path !== section.path),
]);
