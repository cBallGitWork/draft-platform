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
import { InvitesPage } from "./joining/InvitesPage";
import { JoinPage } from "./joining/JoinPage";
import { INVITES_ROUTE, JOIN_ROUTE, joinTokenAt } from "./joining/paths";
import type { JoiningSeam } from "./joining/seam";
import { signInToJoinWords } from "./joining/words";
import type { LeagueActions } from "./leagues/actions";
import { LeaguelessFrame } from "./leagues/LeaguelessFrame";
import { LeaguesPage } from "./leagues/LeaguesPage";
import { NewLeaguePage } from "./leagues/NewLeaguePage";
import { LEAGUES_PATH, NEW_LEAGUE_PATH } from "./leagues/paths";
import { SignInPage } from "./sign-in/SignInPage";
import { linkProblemWords, type LinkProblem } from "./sign-in/words";

export type ShellContext = { session: Session; auth: AuthActions; leagues: LeagueActions; joining: JoiningSeam; topBar: TopBarState };

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
  // Each always set, if only to undefined: a route's search is laid over the address's own. `join`
  // is the invite link a signed-out visitor opened, which their sign-in link leads back to (#73).
  validateSearch: (search): { link?: LinkProblem; join?: string } => ({
    link: isLinkProblem(search.link) ? search.link : undefined,
    join: typeof search.join === "string" && search.join ? search.join : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.session.signedIn) throw redirect(search.join ? { to: JOIN_ROUTE, params: { token: search.join } } : { to: "/" });
  },
  component: function SignIn() {
    const { auth, joining } = signInRoute.useRouteContext();
    const { link, join } = signInRoute.useSearch();
    const requestSignInLink = join ? (email: string) => joining.signInToJoin(join, email) : auth.requestSignInLink;
    return <SignInPage requestSignInLink={requestSignInLink} linkProblem={link} intro={join && signInToJoinWords} />;
  },
});

// The leagues pages, for anyone signed in: in the league frame for someone in a league, and
// outside it, with no league menu, for someone in none (spec/02).
const leaguePagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "leaguePages",
  beforeLoad: ({ context, location }) => {
    if (!context.session.signedIn) throw redirect({ to: SIGN_IN_PATH, search: { join: joinTokenAt(location.pathname) ?? undefined } });
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

// Joining a league (#73): a league's invites and join requests, for its runners, and its invite
// link, which a signed-out visitor reaches through sign-in.
const invitesRoute = createRoute({
  getParentRoute: () => leaguePagesRoute,
  path: INVITES_ROUTE,
  component: function Invites() {
    const joining = invitesRoute.useRouteContext({ select: (context) => context.joining });
    return <InvitesPage leagueId={invitesRoute.useParams().leagueId} joining={joining} />;
  },
});

const joinRoute = createRoute({
  getParentRoute: () => leaguePagesRoute,
  path: JOIN_ROUTE,
  component: function Join() {
    const joining = joinRoute.useRouteContext({ select: (context) => context.joining });
    return <JoinPage token={joinRoute.useParams().token} joining={joining} />;
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
  leaguePagesRoute.addChildren([leaguesRoute, newLeagueRoute, invitesRoute, joinRoute]),
  frameRoute.addChildren([landingRoute, ...pageRoutes]),
]);

// Not registered for typed links yet: the pages above are made in a loop, so their paths are plain
// strings. Each screen that gets built gets its own route, and the types come with them.
export function createShellRouter(context: ShellContext, history?: RouterHistory) {
  return createRouter({ routeTree, context, history });
}
