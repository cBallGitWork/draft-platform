import { Navigate, Outlet, createRootRouteWithContext, createRoute, redirect, type ErrorComponentProps } from "@tanstack/react-router";
import type { AdminSeam } from "../admin/seam";
import type { AuthActions, Session } from "../auth";
import { AppFrame } from "../frame/AppFrame";
import { ErrorScreen } from "../frame/ErrorScreen";
import type { FeedbackSeam } from "../feedback/seam";
import { LeagueSwitcher } from "../frame/LeagueSwitcher";
import { SignOut } from "../frame/SignOut";
import type { TopBarState } from "../frame/topBarState";
import type { GameweeksSeam } from "../gameweeks/seam";
import type { HomeSeam } from "../home/seam";
import { JOIN_ROUTE, joinTokenAt } from "../joining/paths";
import type { JoiningSeam } from "../joining/seam";
import { signInToJoinWords } from "../joining/words";
import { LeaguelessFrame } from "../leagues/LeaguelessFrame";
import { LEAGUES_PATH } from "../leagues/paths";
import { leagueIn, leagueRunBy } from "../leagues/roles";
import type { LeaguesSeam } from "../leagues/seam";
import type { LeagueSettingsSeam } from "../leagueSettings/seam";
import type { MailSeam } from "../mail/seam";
import type { MatchupSeam } from "../matchup/seam";
import type { MyTeamSeam } from "../myTeam/seam";
import { PatchBanner } from "../patches/PatchBanner";
import type { PatchesSeam } from "../patches/seam";
import type { PlayerCardSeam } from "../playerCard/seam";
import type { PremierLeagueSeam } from "../premierLeague/seam";
import type { ScoringSeam } from "../scoring/seam";
import type { ScoutingSeam } from "../scouting/seam";
import { SIGN_IN_PATH } from "../sign-in/paths";
import { SignInPage } from "../sign-in/SignInPage";
import { linkProblemWords, type LinkProblem } from "../sign-in/words";
import type { SquadsSeam } from "../squads/seam";
import type { TableSeam } from "../table/seam";

// The routes' root (src/router.tsx assembles the tree): the context every route reads, the guards,
// sign-in, and the two frames the app's pages hang from, leaguePages.tsx's and frame.tsx's.

// A seam is a top-level useLive* hook holding root state (mail, joining, squads, scoring, league
// settings, admin, leagues, feedback, patches) or a constant object of hooks (gameweeks, table, scouting, player card, home, my team, matchup, Premier League). Each new one needs a
// preview (previewApp.tsx), a live value (liveApp.tsx) and a fake (shell.harness.tsx), and the
// typechecker flags any that's missing.
export type ShellContext = {
  session: Session;
  auth: AuthActions;
  leagues: LeaguesSeam;
  mail: MailSeam;
  joining: JoiningSeam;
  topBar: TopBarState;
  gameweeks: GameweeksSeam;
  squads: SquadsSeam;
  scoring: ScoringSeam;
  leagueSettings: LeagueSettingsSeam;
  table: TableSeam;
  scouting: ScoutingSeam;
  playerCard: PlayerCardSeam;
  home: HomeSeam;
  myTeam: MyTeamSeam;
  matchup: MatchupSeam;
  premierLeague: PremierLeagueSeam;
  admin: AdminSeam;
  feedback: FeedbackSeam;
  patches: PatchesSeam;
};

/** Where the app opens: the guards below send each visitor on from here. */
export const LANDING_PATH = "/";

/** A player's or a match's code in an address: FPL's codes are whole numbers. */
export const CODE_DIGITS = /^\d+$/;

// Any address nobody knows goes back to `/`, which the guards below send on: to the sign-in page
// for a visitor, to their leagues for someone in none, to My team for a manager. So a visitor only
// ever sees the sign-in page (spec/12).
export const rootRoute = createRootRouteWithContext<ShellContext>()({
  component: Outlet,
  notFoundComponent: () => <Navigate to={LANDING_PATH} replace />,
});

/** The app's frame for someone in a league: the menu, the top bar and the league switcher. */
function LeagueFrame({ context: { session, topBar, auth, leagues, patches } }: { context: ShellContext }) {
  const leagueSwitcher = <LeagueSwitcher session={session} switchLeague={leagues.switchLeague} leaveLeague={leagues.leaveLeague} />;
  return <AppFrame topBar={topBar} onSignOut={auth.signOut} leagueSwitcher={leagueSwitcher} banner={<PatchBanner seam={patches} />} />;
}

/** What a frame shows when drawing the frame itself threw, such as the league switcher finding the
 *  app in a league that isn't one of theirs (#207): the error page, with Sign out, as the top bar's
 *  isn't there, and "Your leagues" may well throw the same way. */
function FrameFailed(failed: ErrorComponentProps) {
  const { auth } = rootRoute.useRouteContext();
  return (
    <ErrorScreen {...failed}>
      <SignOut onSignOut={auth.signOut} />
    </ErrorScreen>
  );
}

// The guards on a page for the admin alone, on a league's page for whoever runs it, and on one for
// anyone in it: anyone else is sent back to their leagues.
export const adminOnly = ({ context }: { context: ShellContext }) => {
  if (!(context.session.signedIn && context.session.isAdmin)) throw redirect({ to: LEAGUES_PATH });
};
export const runnersOnly = ({ context, params }: { context: ShellContext; params: { leagueId: string } }) => {
  if (!leagueRunBy(context.session, params.leagueId)) throw redirect({ to: LEAGUES_PATH });
};
export const membersOnly = ({ context, params }: { context: ShellContext; params: { leagueId: string } }) => {
  if (!leagueIn(context.session, params.leagueId)) throw redirect({ to: LEAGUES_PATH });
};

const isLinkProblem = (value: unknown): value is LinkProblem =>
  typeof value === "string" && Object.hasOwn(linkProblemWords, value);

export const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: SIGN_IN_PATH,
  // Each always set, if only to undefined: a route's search is laid over the address's own. `join`
  // is the invite link a signed-out visitor opened, which their sign-in link leads back to (#73).
  validateSearch: (search): { link?: LinkProblem; join?: string } => ({
    link: isLinkProblem(search.link) ? search.link : undefined,
    join: typeof search.join === "string" && search.join ? search.join : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.session.signedIn) throw redirect(search.join ? { to: JOIN_ROUTE, params: { token: search.join } } : { to: LANDING_PATH });
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
export const leaguePagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "leaguePages",
  beforeLoad: ({ context, location }) => {
    if (!context.session.signedIn) throw redirect({ to: SIGN_IN_PATH, search: { join: joinTokenAt(location.pathname) ?? undefined } });
  },
  component: function LeaguePages() {
    const context = leaguePagesRoute.useRouteContext();
    return context.session.signedIn && context.session.inLeague ? (
      <LeagueFrame context={context} />
    ) : (
      <LeaguelessFrame unreadMail={context.topBar.unreadMail} onSignOut={context.auth.signOut} banner={<PatchBanner seam={context.patches} />} />
    );
  },
  errorComponent: FrameFailed,
});

export const frameRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "frame",
  beforeLoad: ({ context }) => {
    if (!context.session.signedIn) throw redirect({ to: SIGN_IN_PATH });
    if (!context.session.inLeague) throw redirect({ to: LEAGUES_PATH });
  },
  component: function Frame() {
    return <LeagueFrame context={frameRoute.useRouteContext()} />;
  },
  errorComponent: FrameFailed,
});
