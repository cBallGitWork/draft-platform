// The top menu and each section's second row of tabs (spec/12-screens.md, "The frame").
// The sections are the screens spec/12 lists, in R3·1's order (docs/design/mockups/PlateOne.dc.html),
// with the Premier League as its own section (spec/18) and Scouting in place of Players (spec/19).
// My team's tabs are R3·1's; a section gets tabs when its screen is grilled, and until then has no
// second row.

import { DRAFT_TITLE } from "../draft/words";
import { MAIL_TITLE } from "../mail/words";
import { menuWords } from "./words";

type Page = { label: string; path: string };
export type Section = Page & { tabs: readonly Page[] };

export const HOME_PATH = "/home";
/** League home's News tab (#1356): every team's moves. */
export const HOME_NEWS_PATH = `${HOME_PATH}/news`;
export const MY_TEAM_PATH = "/team";
export const MY_TEAM_SQUAD_PATH = `${MY_TEAM_PATH}/squad`;
export const MY_TEAM_FIXTURES_PATH = `${MY_TEAM_PATH}/fixtures`;
export const MY_TEAM_TRANSACTIONS_PATH = `${MY_TEAM_PATH}/transactions`;
export const MAIL_PATH = "/mail";
export const TABLE_PATH = "/table";
export const SCOUTING_PATH = "/scouting";
export const MATCHUP_PATH = "/matchup";
export const TRADES_PATH = "/trades";
/** Trades' New offer tab (#383). */
export const TRADES_NEW_PATH = `${TRADES_PATH}/new`;
export const PREMIER_LEAGUE_PATH = "/premier-league";

export const sections: readonly Section[] = [
  {
    label: menuWords.home,
    path: HOME_PATH,
    // Overview and News, as the approved Home pictures have them; Calendar waits for its grill.
    tabs: [
      { label: menuWords.overview, path: HOME_PATH },
      { label: menuWords.news, path: HOME_NEWS_PATH },
    ],
  },
  {
    label: menuWords.myTeam,
    path: MY_TEAM_PATH,
    tabs: [
      { label: menuWords.tactics, path: MY_TEAM_PATH },
      { label: menuWords.squad, path: MY_TEAM_SQUAD_PATH },
      { label: menuWords.fixtures, path: MY_TEAM_FIXTURES_PATH },
      { label: menuWords.transactions, path: MY_TEAM_TRANSACTIONS_PATH },
    ],
  },
  { label: menuWords.matchup, path: MATCHUP_PATH, tabs: [] },
  { label: menuWords.table, path: TABLE_PATH, tabs: [] },
  { label: menuWords.scouting, path: SCOUTING_PATH, tabs: [] },
  {
    label: menuWords.trades,
    path: TRADES_PATH,
    // Offers and New offer, as the approved Trades pictures have them (#383).
    tabs: [
      { label: menuWords.offers, path: TRADES_PATH },
      { label: menuWords.newOffer, path: TRADES_NEW_PATH },
    ],
  },
  { label: menuWords.premierLeague, path: PREMIER_LEAGUE_PATH, tabs: [] },
  { label: MAIL_TITLE, path: MAIL_PATH, tabs: [] },
];

/** The draft room (spec/04, The draft room): in the menu after My team, as the approved picture
 *  has it, from the moment the league is set up until the draft is over (Craig, 4 Nov 2026). */
export const DRAFT_PATH = "/draft";
const draftSection: Section = { label: DRAFT_TITLE, path: DRAFT_PATH, tabs: [] };

/** The menu's sections, with the draft room's while it is in the menu. */
export const sectionsWith = (draftInMenu: boolean): readonly Section[] =>
  draftInMenu ? [sections[0], sections[1], draftSection, ...sections.slice(2)] : sections;

export function sectionAt(pathname: string): Section | undefined {
  return sections.find((section) => pathname === section.path || pathname.startsWith(`${section.path}/`));
}

/** Every page the menu reaches: each section, and each tab that isn't its section's own page. */
export const pages: readonly Page[] = sections.flatMap((section) => [
  { label: section.label, path: section.path },
  ...section.tabs.filter((tab) => tab.path !== section.path),
]);
