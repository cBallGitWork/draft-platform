// The screens' tests' shared setup: the app opened at an address, for a session, with sign-in's
// actions faked so a test can see what was asked of them.

import { createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import type { AuthActions, Session } from "./auth";
import { emptyTopBar, type TopBarState } from "./frame/topBarState";
import { ShellApp } from "./ShellApp";

// The router restores scroll on every navigation, and jsdom has no scrolling to restore.
window.scrollTo = () => {};

export const visitor: Session = { signedIn: false };
export const manager: Session = { signedIn: true, email: "manager@example.com", isAdmin: false, inLeague: true };
export const newcomer: Session = { ...manager, inLeague: false };
export const admin: Session = { signedIn: true, email: "craig@example.com", isAdmin: true, inLeague: false };

export const LINK_REPLY = "Check your email.";

function fakeAuth() {
  return {
    requestSignInLink: vi.fn<AuthActions["requestSignInLink"]>(async () => LINK_REPLY),
    signOut: vi.fn<AuthActions["signOut"]>(async () => {}),
  };
}

/** The app opened at `path` for `session`: where it is, the fake sign-in actions, and a way to
 *  change the session as signing in or out would. */
export function openApp(path: string, session: Session, topBar: TopBarState = emptyTopBar) {
  const history = createMemoryHistory({ initialEntries: [path] });
  const auth = fakeAuth();
  const view = render(<ShellApp session={session} auth={auth} topBar={topBar} history={history} />);
  return {
    auth,
    path: () => history.location.pathname,
    becomes: (next: Session) => view.rerender(<ShellApp session={next} auth={auth} topBar={topBar} history={history} />),
  };
}
