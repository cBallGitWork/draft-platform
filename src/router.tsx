import type { ComponentType } from "react";
import {
  Navigate,
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  type RouterHistory,
} from "@tanstack/react-router";
import { AdminPage } from "./admin/AdminPage";
import { FeedbackTab } from "./admin/FeedbackTab";
import { FeedsPage } from "./admin/FeedsPage";
import { ADMIN_FEEDBACK_PATH, ADMIN_FEEDS_PATH, ADMIN_PATH } from "./admin/paths";
import type { AdminSeam } from "./admin/seam";
import type { AuthActions, Session } from "./auth";
import { AppFrame } from "./frame/AppFrame";
import { FeedbackPage } from "./feedback/FeedbackPage";
import { FEEDBACK_PATH } from "./feedback/paths";
import type { FeedbackSeam } from "./feedback/seam";
import { ErrorScreen } from "./frame/ErrorScreen";
import { LeagueSwitcher } from "./frame/LeagueSwitcher";
import type { TopBarState } from "./frame/topBarState";
import { MAIL_PATH, MY_TEAM_FIXTURES_PATH, MY_TEAM_PATH, pages, SCOUTING_PATH, TABLE_PATH } from "./frame/menu";
import { PageNotBuilt } from "./frame/PageNotBuilt";
import { GameweeksRoute } from "./gameweeks/GameweeksRoute";
import type { LeagueSummary } from "../convex/leagues/myLeagues";
import { GAMEWEEKS_ROUTE } from "./gameweeks/paths";
import type { GameweeksSeam } from "./gameweeks/seam";
import { InvitesPage } from "./joining/InvitesPage";
import { JoinPage } from "./joining/JoinPage";
import { INVITES_ROUTE, JOIN_ROUTE, joinTokenAt } from "./joining/paths";
import type { JoiningSeam } from "./joining/seam";
import { signInToJoinWords } from "./joining/words";
import type { LeaguesSeam } from "./leagues/seam";
import { LeaguelessFrame } from "./leagues/LeaguelessFrame";
import { LeaguesPage } from "./leagues/LeaguesPage";
import { NewLeaguePage } from "./leagues/NewLeaguePage";
import { LEAGUES_PATH, NEW_LEAGUE_PATH } from "./leagues/paths";
import { leagueIn, leagueRunBy } from "./leagues/roles";
import type { MailSeam } from "./mail/seam";
import { FixturesPage } from "./myTeam/FixturesPage";
import { MyTeamRoute } from "./myTeam/MyTeamRoute";
import type { MyTeamSeam } from "./myTeam/seam";
import { PatchBanner } from "./patches/PatchBanner";
import { PatchNotesPage } from "./patches/PatchNotesPage";
import { PATCH_NOTES_PATH } from "./patches/paths";
import type { PatchesSeam } from "./patches/seam";
import { MailPage, leaguesToWriteFrom } from "./mail/MailPage";
import { SIGN_IN_PATH } from "./sign-in/paths";
import { SignInPage } from "./sign-in/SignInPage";
import { SETTINGS_ROUTE } from "./leagueSettings/paths";
import type { LeagueSettingsSeam } from "./leagueSettings/seam";
import { SettingsPage } from "./leagueSettings/SettingsPage";
import { SCORING_ROUTE } from "./scoring/paths";
import type { ScoringSeam } from "./scoring/seam";
import { ScoringPage } from "./scoring/ScoringPage";
import { SQUADS_ROUTE } from "./squads/paths";
import type { SquadsSeam } from "./squads/seam";
import { SquadsPage } from "./squads/SquadsPage";
import { linkProblemWords, type LinkProblem } from "./sign-in/words";
import { PLAYER_CARD_ROUTE } from "./playerCard/paths";
import { PlayerCardPage } from "./playerCard/PlayerCardPage";
import type { PlayerCardSeam } from "./playerCard/seam";
import type { ScoutingSeam } from "./scouting/seam";
import { ScoutingRoute } from "./scouting/ScoutingRoute";
import type { TableSeam } from "./table/seam";
import { TableRoute } from "./table/TableRoute";

// A seam is a top-level useLive* hook holding root state (mail, joining, squads, scoring, league
// settings, admin, leagues, feedback, patches) or a constant object of hooks (gameweeks, table, scouting, player card, my team). Each new one needs a
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
  myTeam: MyTeamSeam;
  admin: AdminSeam;
  feedback: FeedbackSeam;
  patches: PatchesSeam;
};

/** Where the app opens: the guards below send each visitor on from here. */
const LANDING_PATH = "/";

// Any address nobody knows goes back to `/`, which the guards below send on: to the sign-in page
// for a visitor, to their leagues for someone in none, to My team for a manager. So a visitor only
// ever sees the sign-in page (spec/12).
const rootRoute = createRootRouteWithContext<ShellContext>()({
  component: Outlet,
  notFoundComponent: () => <Navigate to={LANDING_PATH} replace />,
});

/** The app's frame for someone in a league: the menu, the top bar and the league switcher. */
function LeagueFrame({ context: { session, topBar, auth, leagues, patches } }: { context: ShellContext }) {
  const leagueSwitcher = <LeagueSwitcher session={session} switchLeague={leagues.switchLeague} leaveLeague={leagues.leaveLeague} />;
  return <AppFrame topBar={topBar} onSignOut={auth.signOut} leagueSwitcher={leagueSwitcher} banner={<PatchBanner seam={patches} />} />;
}

// The guards on a page for the admin alone, on a league's page for whoever runs it, and on one for
// anyone in it: anyone else is sent back to their leagues.
const adminOnly = ({ context }: { context: ShellContext }) => {
  if (!(context.session.signedIn && context.session.isAdmin)) throw redirect({ to: LEAGUES_PATH });
};
const runnersOnly = ({ context, params }: { context: ShellContext; params: { leagueId: string } }) => {
  if (!leagueRunBy(context.session, params.leagueId)) throw redirect({ to: LEAGUES_PATH });
};
const membersOnly = ({ context, params }: { context: ShellContext; params: { leagueId: string } }) => {
  if (!leagueIn(context.session, params.leagueId)) throw redirect({ to: LEAGUES_PATH });
};

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
const leaguePagesRoute = createRoute({
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
});

const leaguesRoute = createRoute({
  getParentRoute: () => leaguePagesRoute,
  path: LEAGUES_PATH,
  component: function Leagues() {
    const { session, leagues, joining } = leaguesRoute.useRouteContext();
    return session.signedIn ? (
      <LeaguesPage
        email={session.email}
        isAdmin={session.isAdmin}
        leagues={session.leagues}
        leaguesCut={session.leaguesCut === true}
        actions={leagues}
        useEndedInvite={joining.useEndedInvite}
      />
    ) : null;
  },
});

const newLeagueRoute = createRoute({
  getParentRoute: () => leaguePagesRoute,
  path: NEW_LEAGUE_PATH,
  beforeLoad: adminOnly,
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

/** The seams of the pages a league's runners open from its row on Your leagues. */
type RunnerSeams = Pick<ShellContext, "gameweeks" | "squads" | "leagueSettings">;

/** A page of one league's for whoever runs it, at `path`: `Page` is given the league in the address
 *  and its seam from the context. The guard lets in only someone who runs the league; should they
 *  stop while here, this shows nothing until the guard sends them on. */
function runnersPage<Seam extends keyof RunnerSeams, Path extends `${string}/$leagueId/${string}`>(
  path: Path,
  seam: Seam,
  Page: ComponentType<{ league: LeagueSummary; seam: RunnerSeams[Seam] }>,
) {
  const route = createRoute({
    getParentRoute: () => leaguePagesRoute,
    path,
    beforeLoad: runnersOnly,
    component: function RunnersPage() {
      const context = route.useRouteContext();
      const league = leagueRunBy(context.session, route.useParams().leagueId);
      return league ? <Page league={league} seam={context[seam]} /> : null;
    },
  });
  return route;
}

const gameweeksRoute = runnersPage(GAMEWEEKS_ROUTE, "gameweeks", GameweeksRoute); // #74
const squadsRoute = runnersPage(SQUADS_ROUTE, "squads", SquadsPage); // #31
const settingsRoute = runnersPage(SETTINGS_ROUTE, "leagueSettings", SettingsPage); // League settings

// Feedback to the admin (#357), from the top bar's link on either frame.
const feedbackRoute = createRoute({
  getParentRoute: () => leaguePagesRoute,
  path: FEEDBACK_PATH,
  component: function Feedback() {
    return <FeedbackPage send={feedbackRoute.useRouteContext({ select: (context) => context.feedback.send })} />;
  },
});

// The patch notes (#356), from the banner's link and Player scoring's, for anyone signed in.
const patchNotesRoute = createRoute({
  getParentRoute: () => leaguePagesRoute,
  path: PATCH_NOTES_PATH,
  component: function PatchNotes() {
    return <PatchNotesPage seam={patchNotesRoute.useRouteContext({ select: (context) => context.patches })} />;
  },
});

// A player's card (#381), for anyone in the league, opened from his name. A code that isn't a
// number names no player, so it goes to Scouting.
const PLAYER_CODE_DIGITS = /^\d+$/;
const playerCardRoute = createRoute({
  getParentRoute: () => leaguePagesRoute,
  path: PLAYER_CARD_ROUTE,
  beforeLoad: ({ context, params }) => {
    membersOnly({ context, params });
    if (!PLAYER_CODE_DIGITS.test(params.playerCode)) throw redirect({ to: SCOUTING_PATH });
  },
  component: function PlayerCard() {
    const context = playerCardRoute.useRouteContext();
    const { leagueId, playerCode } = playerCardRoute.useParams();
    const league = leagueIn(context.session, leagueId);
    // Keyed by the player, so going from one card to another starts afresh.
    return league ? <PlayerCardPage key={playerCode} league={league} playerCode={Number(playerCode)} seam={context.playerCard} /> : null;
  },
});

// Player scoring (#30): the site's scoring, which anyone in the league reads and the admin alone
// edits (spec/14, Who owns it; #354).
const scoringRoute = createRoute({
  getParentRoute: () => leaguePagesRoute,
  path: SCORING_ROUTE,
  beforeLoad: membersOnly,
  component: function Scoring() {
    const context = scoringRoute.useRouteContext();
    const league = leagueIn(context.session, scoringRoute.useParams().leagueId);
    return league ? <ScoringPage league={league} seam={context.scoring} /> : null;
  },
});

// The admin's dashboard (#87), his alone.
const adminRoute = createRoute({
  getParentRoute: () => leaguePagesRoute,
  path: ADMIN_PATH,
  beforeLoad: adminOnly,
  component: function Admin() {
    const admin = adminRoute.useRouteContext({ select: (context) => context.admin });
    return <AdminPage seam={admin} />;
  },
});

// The dashboard's feeds tab (#35), his alone too.
const adminFeedsRoute = createRoute({
  getParentRoute: () => leaguePagesRoute,
  path: ADMIN_FEEDS_PATH,
  beforeLoad: adminOnly,
  component: function AdminFeeds() {
    const admin = adminFeedsRoute.useRouteContext({ select: (context) => context.admin });
    return <FeedsPage seam={admin} />;
  },
});

// The dashboard's Feedback tab (#357), his alone too.
const adminFeedbackRoute = createRoute({
  getParentRoute: () => leaguePagesRoute,
  path: ADMIN_FEEDBACK_PATH,
  beforeLoad: adminOnly,
  component: function AdminFeedback() {
    const feedback = adminFeedbackRoute.useRouteContext({ select: (context) => context.feedback });
    return <FeedbackTab seam={feedback} />;
  },
});

// Joining a league (#73): a league's invites and join requests, for its runners, and its invite
// link, which a signed-out visitor reaches through sign-in.
const invitesRoute = createRoute({
  getParentRoute: () => leaguePagesRoute,
  path: INVITES_ROUTE,
  beforeLoad: runnersOnly,
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
    return <LeagueFrame context={frameRoute.useRouteContext()} />;
  },
});

// A signed-in manager lands on My team (spec/12).
const landingRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: LANDING_PATH,
  beforeLoad: () => {
    throw redirect({ to: MY_TEAM_PATH });
  },
});

// The league's table and fixtures (#33), for anyone in it.
const tableRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: TABLE_PATH,
  component: function Table() {
    const { session, table } = tableRoute.useRouteContext();
    return <TableRoute session={session} seam={table} />;
  },
});

// Scouting's players list (#373), for anyone in the league.
const scoutingRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: SCOUTING_PATH,
  component: function Scouting() {
    const { session, scouting } = scoutingRoute.useRouteContext();
    return <ScoutingRoute session={session} seam={scouting} />;
  },
});

// My team's Fixtures tab (#365), for anyone in the league: a manager's own team's games.
const myTeamFixturesRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: MY_TEAM_FIXTURES_PATH,
  component: function MyTeamFixtures() {
    const { session, myTeam } = myTeamFixturesRoute.useRouteContext();
    return <MyTeamRoute session={session} seam={myTeam} Tab={FixturesPage} />;
  },
});

const BUILT_PAGES: readonly string[] = [MAIL_PATH, TABLE_PATH, SCOUTING_PATH, MY_TEAM_FIXTURES_PATH];
const pageRoutes = pages.filter((page) => !BUILT_PAGES.includes(page.path)).map((page) =>
  createRoute({
    getParentRoute: () => frameRoute,
    path: page.path,
    component: () => <PageNotBuilt title={page.label} />,
  }),
);

const routeTree = rootRoute.addChildren([
  signInRoute,
  leaguePagesRoute.addChildren([leaguesRoute, newLeagueRoute, mailRoute, invitesRoute, joinRoute, gameweeksRoute, squadsRoute, scoringRoute, playerCardRoute, settingsRoute, adminRoute, adminFeedsRoute, adminFeedbackRoute, feedbackRoute, patchNotesRoute]),
  frameRoute.addChildren([landingRoute, tableRoute, scoutingRoute, myTeamFixturesRoute, ...pageRoutes]),
]);

// Not registered for typed links yet: the pages above are made in a loop, so their paths are plain
// strings. Each screen that gets built gets its own route, and the types come with them.
export function createShellRouter(context: ShellContext, history?: RouterHistory) {
  return createRouter({ routeTree, context, history, defaultErrorComponent: ErrorScreen });
}
