// The screens' tests' shared setup: the app opened at an address, for a session, with sign-in's,
// leagues', Mail's and joining's actions and a league's gameweeks faked so a test can see what was
// asked of them.

import { createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { LetterSummary } from "../../../convex/mail/mail";
import type { LeagueSummary } from "../../../convex/leagues/myLeagues";
import { fakeAdmin, type AdminData } from "./admin.harness";
import type { AuthActions, Session } from "../../../src/auth";
import type { TopBarState } from "../../../src/frame/topBarState";
import { fakeGameweeks } from "./gameweeks.harness";
import { fakeJoining, type JoiningData } from "./joining.harness";
import type { LeagueActions } from "../../../src/leagues/actions";
import type { Mail } from "../../../src/mail/actions";
import { ShellApp } from "../../../src/ShellApp";
import { fakeSquads, type SquadsData } from "./squads.harness";
import { fakeTable, type TableData } from "./table.harness";

// The router restores scroll on every navigation, and jsdom has no scrolling to restore.
window.scrollTo = () => {};

export const visitor: Session = { signedIn: false };

/** A league as signIn/account:signedInAs sends it, for `manager`, who runs Team 1 in it. */
export const league: LeagueSummary = {
  leagueId: "league-1" as Id<"leagues">,
  name: "Tim Hortons Pro League",
  commissionerEmail: "commish@example.com",
  roles: ["manager"],
  teamName: "Team 1",
  teams: 3,
  maxTeams: 4,
  unsentCommissionerLink: null,
};

const signedIn = { signedIn: true, email: "manager@example.com", isAdmin: false } as const;
/** A manager in these leagues, the app in the first. */
export const managerIn = (...leagues: LeagueSummary[]) =>
  ({ ...signedIn, inLeague: true, leagues, currentLeagueId: leagues[0].leagueId }) satisfies Session;
export const manager = managerIn(league);
/** The commissioner of `league`, running no team in it. */
export const commissioner = managerIn({ ...league, roles: ["commissioner"], teamName: null });
export const newcomer: Session = { ...signedIn, inLeague: false, leagues: [], currentLeagueId: null };
/** The admin, seeing every league, with no part in any. */
export const adminSeeing = (...leagues: LeagueSummary[]) =>
  ({
    ...signedIn,
    email: "craig@example.com",
    isAdmin: true,
    inLeague: false,
    leagues,
    currentLeagueId: null,
  }) satisfies Session;
export const admin = adminSeeing();

export const LINK_REPLY = "Check your email.";

function fakeAuth() {
  return {
    requestSignInLink: vi.fn<AuthActions["requestSignInLink"]>(async () => LINK_REPLY),
    signOut: vi.fn<AuthActions["signOut"]>(async () => {}),
  };
}

/** Each league action succeeds, unless a test says otherwise. */
const fakeLeagues = () => ({
  createLeague: vi.fn<LeagueActions["createLeague"]>(async () => null),
  deleteLeague: vi.fn<LeagueActions["deleteLeague"]>(async () => null),
  undoDeletion: vi.fn<LeagueActions["undoDeletion"]>(async () => null),
  switchLeague: vi.fn<LeagueActions["switchLeague"]>(async () => null),
});

/** Mail holding `letters`, whose letter to the league is sent, unless a test says otherwise. */
const fakeMail = (letters: readonly LetterSummary[] | null) => ({
  letters,
  open: vi.fn<Mail["open"]>(async () => {}),
  writeToLeague: vi.fn<Mail["writeToLeague"]>(async () => null),
});

/** What a test may set besides the address and the session: each seam's data, and the top bar. */
export type AppSetUp = {
  topBar?: TopBarState;
  letters?: readonly LetterSummary[] | null;
  joining?: JoiningData;
  squads?: SquadsData;
  table?: TableData;
  admin?: AdminData;
};

/** The app opened at `path` for `session`, set up as `setUp` says: where it is, the fake sign-in,
 *  league, Mail, joining, gameweeks, squads, table and admin seams, and a way to change the session as
 *  signing in or out, or a league changing, would. */
export function openApp(path: string, session: Session, setUp: AppSetUp = {}) {
  const {
    topBar = { unreadMail: 0, next: null },
    letters = [],
    joining: joiningData = {},
    squads: squadsData = {},
    table: tableData = {},
    admin: adminData = {},
  } = setUp;
  const history = createMemoryHistory({ initialEntries: [path] });
  const auth = fakeAuth();
  const leagues = fakeLeagues();
  const mail = fakeMail(letters);
  const joining = fakeJoining(joiningData, LINK_REPLY);
  const gameweeks = fakeGameweeks();
  const squads = fakeSquads(squadsData);
  const table = fakeTable(tableData);
  const admin = fakeAdmin(adminData);
  const app = (current: Session) => (
    <ShellApp
      session={current}
      auth={auth}
      leagues={leagues}
      mail={mail}
      joining={joining}
      topBar={topBar}
      gameweeks={gameweeks}
      squads={squads}
      table={table}
      admin={admin}
      history={history}
    />
  );
  const view = render(app(session));
  return {
    auth,
    leagues,
    mail,
    gameweeks,
    joining,
    squads,
    table,
    admin,
    path: () => history.location.pathname,
    search: () => history.location.search,
    becomes: (next: Session) => view.rerender(app(next)),
  };
}
