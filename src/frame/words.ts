// What the frame says, in one place for Craig to change in the pull request.

import { failedWords } from "../words";

/** The title over a page that couldn't be drawn because reading it failed (ErrorScreen.tsx). */
export const ERROR_PAGE_TITLE = "This page can't be shown";

/** Why, when the failure wasn't a refusal, which shows the server's own words instead (refusalIn, src/refusal.ts). */
export const readFailedWords = failedWords("this page can't be shown");

/** The way back when the whole app failed, above the pages and their menu (liveApp.tsx). */
export const reloadWords = "Reload";

/** The top bar: its two menus, named for screen readers, Continue, and Sign out. */
export const mainMenuLabel = "Main";
export const sectionTabsLabel = "Section";
export const nothingNeedsYouWords = "Nothing needs you";
export const continueWords = "Continue";
export const continueLabel = (reason: string) => `Continue: ${reason}`;
export const signOutWords = "Sign out";

/** The top menu's sections and My team's tabs (menu.ts); Mail's is its page title. */
export const menuWords = {
  home: "Home",
  myTeam: "My team",
  tactics: "Tactics",
  squad: "Squad",
  fixtures: "Fixtures",
  transactions: "Transactions",
  matchup: "Matchup",
  table: "Table",
  players: "Players",
  trades: "Trades",
  premierLeague: "Premier League",
} as const;

/** The top bar's league switcher (LeagueSwitcher.tsx): the league the app is in, and the way to them all. */
export const currentLeagueLabel = "League:";
export const allLeaguesWords = "All your leagues";

/** Leaving the league the app is in, from the foot of the switcher's list (LeaveLeague.tsx). */
export const leaveWords = {
  open: "Leave this league",
  confirm: (leagueName: string, teamName: string) =>
    `Leave ${leagueName}? You stop running ${teamName} at once. ${teamName} stays in the league, for the commissioner to hand on.`,
  yes: "Leave",
  no: "Stay",
} as const;

/** A page the menu reaches before its screen is built (PageNotBuilt.tsx). */
export const notBuiltWords = "This screen isn't built yet.";
