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
import { LeagueSwitcher } from "./frame/LeagueSwitcher";
import type { TopBarState } from "./frame/topBarState";
import { MAIL_PATH, MY_TEAM_PATH, pages } from "./frame/menu";
import { PageNotBuilt } from "./frame/PageNotBuilt";
import { GameweeksRoute } from "./gameweeks/GameweeksRoute";
import { GAMEWEEKS_ROUTE, leagueRunBy } from "./gameweeks/paths";
import type { GameweeksSeam } from "./gameweeks/seam";
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
import type { Mail } from "./mail/actions";
import { MailPage, leaguesToWriteFrom } from "./mail/MailPage";
import { SignInPage } from "./sign-in/SignInPage";
import { linkProblemWords, type LinkProblem } from "./sign-in/words";

export type ShellContext = {
  session: Session;
  auth: AuthActions;
  leagues: LeagueActions;
  mail: Mail;
  joining: JoiningSeam;
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

// The leagues pages and Mail, for anyone signed in: in the league frame for someone in a league,
// and outside it, with no league menu, for someone in none (spec/02). Mail is one of them, not a
// league-frame page, because a manager removed from their last league is told so by letter (spec/13).
const leaguePagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "leaguePages",
  beforeLoad: ({ context, location }) => {
    if (!context.session.signedIn) throw redirect({ to: SIGN_IN_PATH, search: { join: joinTokenAt(location.pathname) ?? undefined } });
  },
  component: function LeaguePages() {
    const { session, topBar, auth, leagues } = leaguePagesRoute.useRouteContext();
    return session.signedIn && session.inLeague ? (
      <AppFrame
        topBar={topBar}
        onSignOut={auth.signOut}
        leagueSwitcher={<LeagueSwitcher session={session} switchLeague={leagues.switchLeague} />}
      />
    ) : (
      <LeaguelessFrame unreadMail={topBar.unreadMail} onSignOut={auth.signOut} />
    );
  },
});

const leaguesRoute = createRoute({
  getParentRoute: () => leaguePagesRoute,
  path: LEAGUES_PATH,
  component: function Leagues() {
    const { session, leagues } = leaguesRoute.useRouteContext();
    return session.signedIn ? (
      <LeaguesPage email={session.email} isAdmin={session.isAdmin} leagues={session.leagues} actions={leagues} />
    ) : null;
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

const mailRoute = createRoute({
  getParentRoute: () => leaguePagesRoute,
  path: MAIL_PATH,
  component: function MailScreen() {
    const { mail, session, topBar } = mailRoute.useRouteContext();
    return <MailPage mail={mail} unread={topBar.unreadMail} writableLeagues={leaguesToWriteFrom(session)} />;
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
    const { session, topBar, auth, leagues } = frameRoute.useRouteContext();
    return (
      <AppFrame
        topBar={topBar}
        onSignOut={auth.signOut}
        leagueSwitcher={<LeagueSwitcher session={session} switchLeague={leagues.switchLeague} />}
      />
    );
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

const pageRoutes = pages.filter((page) => page.path !== MAIL_PATH).map((page) =>
  createRoute({
    getParentRoute: () => frameRoute,
    path: page.path,
    component: () => <PageNotBuilt title={page.label} />,
  }),
);

const routeTree = rootRoute.addChildren([
  signInRoute,
  leaguePagesRoute.addChildren([leaguesRoute, newLeagueRoute, mailRoute, invitesRoute, joinRoute, gameweeksRoute]),
  frameRoute.addChildren([landingRoute, ...pageRoutes]),
]);

// Not registered for typed links yet: the pages above are made in a loop, so their paths are plain
// strings. Each screen that gets built gets its own route, and the types come with them.
export function createShellRouter(context: ShellContext, history?: RouterHistory) {
  return createRouter({ routeTree, context, history });
}
