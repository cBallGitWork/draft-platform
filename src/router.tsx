import {
  Navigate,
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  type RouterHistory,
} from "@tanstack/react-router";
import type { AuthActions, Session } from "./auth";
import { AppFrame } from "./frame/AppFrame";
import type { TopBarState } from "./frame/topBarState";
import { MY_TEAM_PATH, pages } from "./frame/menu";
import { PageNotBuilt } from "./frame/PageNotBuilt";
import { LeaguelessFrame } from "./leagues/LeaguelessFrame";
import { NoLeaguePage } from "./leagues/NoLeaguePage";
import { LEAGUES_PATH, NEW_LEAGUE_PATH } from "./leagues/paths";
import { SignInPage } from "./sign-in/SignInPage";
import { linkProblemWords, type LinkProblem } from "./sign-in/words";

export type ShellContext = { session: Session; auth: AuthActions; topBar: TopBarState };

export const SIGN_IN_PATH = "/sign-in";

// Any address nobody knows goes back to `/`, which the guards below send on: to the sign-in page
// for a visitor, to their leagues for someone in none, to My team for a manager. So a visitor only
// ever sees the sign-in page (spec/12).
const rootRoute = createRootRouteWithContext<ShellContext>()({
  component: Outlet,
  notFoundComponent: () => <Navigate to="/" replace />,
});

const isLinkProblem = (value: unknown): value is LinkProblem =>
  typeof value === "string" && Object.hasOwn(linkProblemWords, value);

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: SIGN_IN_PATH,
  // `link` always set, if only to undefined: a route's search is laid over the address's own.
  validateSearch: (search): { link?: LinkProblem } => ({ link: isLinkProblem(search.link) ? search.link : undefined }),
  beforeLoad: ({ context }) => {
    if (context.session.signedIn) throw redirect({ to: "/" });
  },
  component: function SignIn() {
    const requestSignInLink = signInRoute.useRouteContext({ select: (context) => context.auth.requestSignInLink });
    return <SignInPage requestSignInLink={requestSignInLink} linkProblem={signInRoute.useSearch().link} />;
  },
});

// Signed in but in no league (spec/02): the leagues page, outside the league frame.
const leaguelessRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "leagueless",
  beforeLoad: ({ context }) => {
    if (!context.session.signedIn) throw redirect({ to: SIGN_IN_PATH });
    if (context.session.inLeague) throw redirect({ to: MY_TEAM_PATH });
  },
  component: function Leagueless() {
    return <LeaguelessFrame onSignOut={leaguelessRoute.useRouteContext({ select: (context) => context.auth.signOut })} />;
  },
});

const leaguesRoute = createRoute({
  getParentRoute: () => leaguelessRoute,
  path: LEAGUES_PATH,
  component: function Leagues() {
    const session = leaguesRoute.useRouteContext({ select: (context) => context.session });
    return session.signedIn ? <NoLeaguePage email={session.email} isAdmin={session.isAdmin} /> : null;
  },
});

const newLeagueRoute = createRoute({
  getParentRoute: () => leaguelessRoute,
  path: NEW_LEAGUE_PATH,
  beforeLoad: ({ context }) => {
    if (!(context.session.signedIn && context.session.isAdmin)) throw redirect({ to: LEAGUES_PATH });
  },
  component: () => <PageNotBuilt title="Create a league" />,
});

const frameRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "frame",
  beforeLoad: ({ context }) => {
    if (!context.session.signedIn) throw redirect({ to: SIGN_IN_PATH });
    if (!context.session.inLeague) throw redirect({ to: LEAGUES_PATH });
  },
  component: function Frame() {
    const { topBar, auth } = frameRoute.useRouteContext();
    return <AppFrame topBar={topBar} onSignOut={auth.signOut} />;
  },
});

// A signed-in manager lands on My team (spec/12).
const landingRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: MY_TEAM_PATH });
  },
});

const pageRoutes = pages.map((page) =>
  createRoute({
    getParentRoute: () => frameRoute,
    path: page.path,
    component: () => <PageNotBuilt title={page.label} />,
  }),
);

const routeTree = rootRoute.addChildren([
  signInRoute,
  leaguelessRoute.addChildren([leaguesRoute, newLeagueRoute]),
  frameRoute.addChildren([landingRoute, ...pageRoutes]),
]);

// Not registered for typed links yet: the pages above are made in a loop, so their paths are plain
// strings. Each screen that gets built gets its own route, and the types come with them.
export function createShellRouter(context: ShellContext, history?: RouterHistory) {
  return createRouter({ routeTree, context, history });
}
