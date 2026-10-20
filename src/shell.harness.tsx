// The screens' tests' shared setup: the app opened at an address, for a session, with sign-in's,
// leagues' and Mail's actions faked so a test can see what was asked of them.

import { createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import type { Id } from "../convex/_generated/dataModel";
import type { LetterSummary } from "../convex/mail";
import type { LeagueSummary } from "../convex/myLeagues";
import type { AuthActions, Session } from "./auth";
import { emptyTopBar, type TopBarState } from "./frame/topBarState";
import type { LeagueActions } from "./leagues/actions";
import type { Mail } from "./mail/actions";
import { ShellApp } from "./ShellApp";

// The router restores scroll on every navigation, and jsdom has no scrolling to restore.
window.scrollTo = () => {};

export const visitor: Session = { signedIn: false };

/** A league as account:signedInAs sends it, for `manager`, who runs Team 1 in it. */
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
export const managerIn = (...leagues: LeagueSummary[]): Session => ({ ...signedIn, inLeague: true, leagues });
export const manager = managerIn(league);
export const newcomer: Session = { ...signedIn, inLeague: false, leagues: [] };
/** The admin, seeing every league, with no part in any. */
export const adminSeeing = (...leagues: LeagueSummary[]): Session => ({
  ...signedIn,
  email: "craig@example.com",
  isAdmin: true,
  inLeague: false,
  leagues,
});
export const admin = adminSeeing();

export const LINK_REPLY = "Check your email.";

function fakeAuth() {
  return {
    requestSignInLink: vi.fn<AuthActions["requestSignInLink"]>(async () => LINK_REPLY),
    signOut: vi.fn<AuthActions["signOut"]>(async () => {}),
  };
}

/** Creating a league succeeds, unless a test says otherwise. */
const fakeLeagues = () => ({ createLeague: vi.fn<LeagueActions["createLeague"]>(async () => null) });

/** Mail holding `letters`, whose letter to the league is sent, unless a test says otherwise. */
const fakeMail = (letters: readonly LetterSummary[] | null) => ({
  letters,
  open: vi.fn<Mail["open"]>(async () => {}),
  writeToLeague: vi.fn<Mail["writeToLeague"]>(async () => null),
});

/** The app opened at `path` for `session`, with `letters` in Mail: where it is, the fake sign-in,
 *  league and Mail actions, and a way to change the session as signing in or out, or a league
 *  changing, would. */
export function openApp(
  path: string,
  session: Session,
  topBar: TopBarState = emptyTopBar,
  letters: readonly LetterSummary[] | null = [],
) {
  const history = createMemoryHistory({ initialEntries: [path] });
  const auth = fakeAuth();
  const leagues = fakeLeagues();
  const mail = fakeMail(letters);
  const app = (current: Session) => (
    <ShellApp session={current} auth={auth} leagues={leagues} mail={mail} topBar={topBar} history={history} />
  );
  const view = render(app(session));
  return {
    auth,
    leagues,
    mail,
    path: () => history.location.pathname,
    becomes: (next: Session) => view.rerender(app(next)),
  };
}
