// The screens' tests' shared setup: the app opened at an address, for a session, with sign-in's
// and leagues' actions faked so a test can see what was asked of them.

import { createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import type { Id } from "../convex/_generated/dataModel";
import type { LeagueSummary } from "../convex/myLeagues";
import type { AuthActions, Session } from "./auth";
import { emptyTopBar, type TopBarState } from "./frame/topBarState";
import type { LeagueActions } from "./leagues/actions";
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

/** Each league action succeeds, unless a test says otherwise. */
const fakeLeagues = () => ({
  createLeague: vi.fn<LeagueActions["createLeague"]>(async () => null),
  deleteLeague: vi.fn<LeagueActions["deleteLeague"]>(async () => null),
  undoDeletion: vi.fn<LeagueActions["undoDeletion"]>(async () => null),
});

/** The app opened at `path` for `session`: where it is, the fake sign-in and league actions, and
 *  a way to change the session as signing in or out, or a league changing, would. */
export function openApp(path: string, session: Session, topBar: TopBarState = emptyTopBar) {
  const history = createMemoryHistory({ initialEntries: [path] });
  const auth = fakeAuth();
  const leagues = fakeLeagues();
  const app = (current: Session) => <ShellApp session={current} auth={auth} leagues={leagues} topBar={topBar} history={history} />;
  const view = render(app(session));
  return {
    auth,
    leagues,
    path: () => history.location.pathname,
    becomes: (next: Session) => view.rerender(app(next)),
  };
}
