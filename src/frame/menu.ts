// The top menu and each section's second row of tabs (spec/12-screens.md, "The frame").
// The sections are the screens spec/12 lists, in R3·1's order (docs/design/mockups/PlateOne.dc.html),
// with the Premier League as its own section (spec/18) and Scouting in place of Players (spec/19).
// My team's tabs are R3·1's; a section gets tabs when its screen is grilled, and until then has no
// second row.

import { MAIL_TITLE } from "../mail/words";
import { menuWords } from "./words";

export type Page = { label: string; path: string };
export type Section = Page & { tabs: readonly Page[] };

export const HOME_PATH = "/home";
export const MY_TEAM_PATH = "/team";
export const MY_TEAM_FIXTURES_PATH = `${MY_TEAM_PATH}/fixtures`;
export const MY_TEAM_TRANSACTIONS_PATH = `${MY_TEAM_PATH}/transactions`;
export const MAIL_PATH = "/mail";
export const TABLE_PATH = "/table";
export const SCOUTING_PATH = "/scouting";
export const MATCHUP_PATH = "/matchup";
export const PREMIER_LEAGUE_PATH = "/premier-league";

export const sections: readonly Section[] = [
  { label: menuWords.home, path: HOME_PATH, tabs: [] },
  {
    label: menuWords.myTeam,
    path: MY_TEAM_PATH,
    tabs: [
      { label: menuWords.tactics, path: MY_TEAM_PATH },
      { label: menuWords.squad, path: `${MY_TEAM_PATH}/squad` },
      { label: menuWords.fixtures, path: MY_TEAM_FIXTURES_PATH },
      { label: menuWords.transactions, path: MY_TEAM_TRANSACTIONS_PATH },
    ],
  },
  { label: menuWords.matchup, path: MATCHUP_PATH, tabs: [] },
  { label: menuWords.table, path: TABLE_PATH, tabs: [] },
  { label: menuWords.scouting, path: SCOUTING_PATH, tabs: [] },
  { label: menuWords.trades, path: "/trades", tabs: [] },
  { label: menuWords.premierLeague, path: PREMIER_LEAGUE_PATH, tabs: [] },
  { label: MAIL_TITLE, path: MAIL_PATH, tabs: [] },
];

export function sectionAt(pathname: string): Section | undefined {
  return sections.find((section) => pathname === section.path || pathname.startsWith(`${section.path}/`));
}

/** Every page the menu reaches: each section, and each tab that isn't its section's own page. */
export const pages: readonly Page[] = sections.flatMap((section) => [
  { label: section.label, path: section.path },
  ...section.tabs.filter((tab) => tab.path !== section.path),
]);
