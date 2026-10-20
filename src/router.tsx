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
import { GameweeksRoute } from "./gameweeks/GameweeksRoute";
import { GAMEWEEKS_ROUTE, leagueRunBy, type GameweeksSeam } from "./gameweeks/seam";
import type { LeagueActions } from "./leagues/actions";
import { LeaguelessFrame } from "./leagues/LeaguelessFrame";
import { LeaguesPage } from "./leagues/LeaguesPage";
import { NewLeaguePage } from "./leagues/NewLeaguePage";
import { LEAGUES_PATH, NEW_LEAGUE_PATH } from "./leagues/paths";
import { SignInPage } from "./sign-in/SignInPage";
import { linkProblemWords, type LinkProblem } from "./sign-in/words";

export type ShellContext = {
  session: Session;
  auth: AuthActions;
  leagues: LeagueActions;
  topBar: TopBarState;
  gameweeks: GameweeksSeam;
};

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

// The leagues pages, for anyone signed in: in the league frame for someone in a league, and
// outside it, with no league menu, for someone in none (spec/02).
const leaguePagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "leaguePages",
  beforeLoad: ({ context }) => {
    if (!context.session.signedIn) throw redirect({ to: SIGN_IN_PATH });
  },
  component: function LeaguePages() {
    const { session, topBar, auth } = leaguePagesRoute.useRouteContext();
    return session.signedIn && session.inLeague ? (
      <AppFrame topBar={topBar} onSignOut={auth.signOut} />
    ) : (
      <LeaguelessFrame onSignOut={auth.signOut} />
    );
  },
});

const leaguesRoute = createRoute({
  getParentRoute: () => leaguePagesRoute,
  path: LEAGUES_PATH,
  component: function Leagues() {
    const session = leaguesRoute.useRouteContext({ select: (context) => context.session });
    return session.signedIn ? <LeaguesPage email={session.email} isAdmin={session.isAdmin} leagues={session.leagues} /> : null;
  },
});

const newLeagueRoute = createRoute({
  getParentRoute: () => leaguePagesRoute,
  path: NEW_LEAGUE_PATH,
  beforeLoad: ({ context }) => {
    if (!(context.session.signedIn && context.session.isAdmin)) throw redirect({ to: LEAGUES_PATH });
  },
  component: function NewLeague() {
    return <NewLeaguePage createLeague={newLeagueRoute.useRouteContext({ select: (context) => context.leagues.createLeague })} />;
  },
});

// A league's gameweeks, for whoever runs it (#74).
const gameweeksRoute = createRoute({
  getParentRoute: () => leaguePagesRoute,
  path: GAMEWEEKS_ROUTE,
  beforeLoad: ({ context, params }) => {
    if (!leagueRunBy(context.session, params.leagueId)) throw redirect({ to: LEAGUES_PATH });
  },
  component: function Gameweeks() {
    const { session, gameweeks } = gameweeksRoute.useRouteContext();
    return <GameweeksRoute session={session} seam={gameweeks} leagueId={gameweeksRoute.useParams().leagueId} />;
  },
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
  leaguePagesRoute.addChildren([leaguesRoute, newLeagueRoute, gameweeksRoute]),
  frameRoute.addChildren([landingRoute, ...pageRoutes]),
]);

// Not registered for typed links yet: the pages above are made in a loop, so their paths are plain
// strings. Each screen that gets built gets its own route, and the types come with them.
export function createShellRouter(context: ShellContext, history?: RouterHistory) {
  return createRouter({ routeTree, context, history });
}
