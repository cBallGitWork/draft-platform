import type { ComponentType } from "react";
import { createRoute, redirect } from "@tanstack/react-router";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { AdminPage } from "../admin/AdminPage";
import { FeedbackTab } from "../admin/FeedbackTab";
import { FeedsPage } from "../admin/FeedsPage";
import { ADMIN_FEEDBACK_PATH, ADMIN_FEEDS_PATH, ADMIN_PATH } from "../admin/paths";
import { FeedbackPage } from "../feedback/FeedbackPage";
import { FEEDBACK_PATH } from "../feedback/paths";
import { MAIL_PATH, SCOUTING_PATH } from "../frame/menu";
import { GameweeksRoute } from "../gameweeks/GameweeksRoute";
import { GAMEWEEKS_ROUTE } from "../gameweeks/paths";
import { InvitesPage } from "../joining/InvitesPage";
import { JoinPage } from "../joining/JoinPage";
import { INVITES_ROUTE, JOIN_ROUTE } from "../joining/paths";
import { LeaguesPage } from "../leagues/LeaguesPage";
import { NewLeaguePage } from "../leagues/NewLeaguePage";
import { LEAGUES_PATH, NEW_LEAGUE_PATH } from "../leagues/paths";
import { leagueIn, leagueRunBy, runs } from "../leagues/roles";
import { SETTINGS_ROUTE } from "../leagueSettings/paths";
import { SettingsPage } from "../leagueSettings/SettingsPage";
import { MailPage, leaguesToWriteFrom } from "../mail/MailPage";
import { mailSearchOf } from "../mail/paths";
import { PatchNotesPage } from "../patches/PatchNotesPage";
import { PATCH_NOTES_PATH } from "../patches/paths";
import { PLAYER_CARD_ROUTE } from "../playerCard/paths";
import { PlayerCardPage } from "../playerCard/PlayerCardPage";
import { SCORING_ROUTE } from "../scoring/paths";
import { ScoringPage } from "../scoring/ScoringPage";
import { SQUADS_ROUTE } from "../squads/paths";
import { SquadsPage } from "../squads/SquadsPage";
import { adminOnly, CODE_DIGITS, leaguePagesRoute, membersOnly, runnersOnly, type ShellContext } from "./root";

// The pages under root.tsx's leaguePagesRoute, for anyone signed in, in a league or not.

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
  validateSearch: mailSearchOf,
  component: function MailScreen() {
    const { mail, session, topBar } = mailRoute.useRouteContext();
    const { letter } = mailRoute.useSearch();
    return <MailPage mail={mail} unread={topBar.unreadMail} writableLeagues={leaguesToWriteFrom(session)} opened={letter} />;
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
const playerCardRoute = createRoute({
  getParentRoute: () => leaguePagesRoute,
  path: PLAYER_CARD_ROUTE,
  beforeLoad: ({ context, params }) => {
    membersOnly({ context, params });
    if (!CODE_DIGITS.test(params.playerCode)) throw redirect({ to: SCOUTING_PATH });
  },
  component: function PlayerCard() {
    const context = playerCardRoute.useRouteContext();
    const { leagueId, playerCode } = playerCardRoute.useParams();
    const league = leagueIn(context.session, leagueId);
    if (!league) return null;
    return (
      <PlayerCardPage
        // Keyed by the player, so going from one card to another starts afresh.
        key={playerCode}
        league={league}
        runs={runs(league)}
        playerCode={Number(playerCode)}
        seam={context.playerCard}
      />
    );
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

/** The seams of the admin's dashboard tabs. */
type AdminSeams = Pick<ShellContext, "admin" | "feedback">;

/** A tab of the admin's dashboard at `path`, his alone: `Page` is given its seam, selected from the
 *  context so the tab re-renders only when that seam changes. */
function adminPage<Seam extends keyof AdminSeams, Path extends string>(path: Path, seam: Seam, Page: ComponentType<{ seam: AdminSeams[Seam] }>) {
  const route = createRoute({
    getParentRoute: () => leaguePagesRoute,
    path,
    beforeLoad: adminOnly,
    component: function AdminTab() {
      const selected = route.useRouteContext({ select: (context) => context[seam] });
      return <Page seam={selected} />;
    },
  });
  return route;
}

const adminRoute = adminPage(ADMIN_PATH, "admin", AdminPage); // The admin's dashboard (#87)
const adminFeedsRoute = adminPage(ADMIN_FEEDS_PATH, "admin", FeedsPage); // Its feeds tab (#35)
const adminFeedbackRoute = adminPage(ADMIN_FEEDBACK_PATH, "feedback", FeedbackTab); // Its Feedback tab (#357)

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

export const leaguePagesChildren = [leaguesRoute, newLeagueRoute, mailRoute, invitesRoute, joinRoute, gameweeksRoute, squadsRoute, scoringRoute, playerCardRoute, settingsRoute, adminRoute, adminFeedsRoute, adminFeedbackRoute, feedbackRoute, patchNotesRoute];
