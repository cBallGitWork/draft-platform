import type { ComponentProps } from "react";
import { createRoute, redirect } from "@tanstack/react-router";
import { HOME_PATH, MAIL_PATH, MATCHUP_PATH, MY_TEAM_FIXTURES_PATH, MY_TEAM_PATH, MY_TEAM_SQUAD_PATH, MY_TEAM_TRANSACTIONS_PATH, pages, PREMIER_LEAGUE_PATH, SCOUTING_PATH, TABLE_PATH } from "../frame/menu";
import { PageNotBuilt } from "../frame/PageNotBuilt";
import { HomeRoute } from "../home/HomeRoute";
import { MatchupRoute } from "../matchup/MatchupRoute";
import { matchupSearchOf } from "../matchup/paths";
import { FixturesPage } from "../myTeam/FixturesPage";
import { MyTeamRoute } from "../myTeam/MyTeamRoute";
import { SquadPage } from "../myTeam/SquadPage";
import { TacticsPage } from "../myTeam/TacticsPage";
import { TransactionsPage } from "../myTeam/TransactionsPage";
import { MatchRoute } from "../premierLeague/MatchRoute";
import { MATCH_ROUTE } from "../premierLeague/paths";
import { PremierLeaguePage } from "../premierLeague/PremierLeaguePage";
import { ScoutingRoute } from "../scouting/ScoutingRoute";
import { TableRoute } from "../table/TableRoute";
import { CODE_DIGITS, LANDING_PATH, frameRoute } from "./root";

// The pages under root.tsx's frameRoute, for anyone in a league, in its frame; and a placeholder for
// each menu page not built yet.

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

// League home (#387), for anyone in the league.
const homeRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: HOME_PATH,
  component: function Home() {
    const { session, home } = homeRoute.useRouteContext();
    return <HomeRoute session={session} seam={home} />;
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

/** One of My team's tabs at `path`, for anyone in the league: `Tab` is given the league the app is
 *  in and the My team seam. */
function myTeamTab(path: string, Tab: ComponentProps<typeof MyTeamRoute>["Tab"]) {
  const route = createRoute({
    getParentRoute: () => frameRoute,
    path,
    component: function MyTeamTab() {
      const { session, myTeam } = route.useRouteContext();
      return <MyTeamRoute session={session} seam={myTeam} Tab={Tab} />;
    },
  });
  return route;
}

// My team's Tactics tab (#14), where a manager lands: his own team's lineup on the pitch.
const myTeamTacticsRoute = myTeamTab(MY_TEAM_PATH, TacticsPage);
const myTeamSquadRoute = myTeamTab(MY_TEAM_SQUAD_PATH, SquadPage); // #364
const myTeamFixturesRoute = myTeamTab(MY_TEAM_FIXTURES_PATH, FixturesPage); // #365
const myTeamTransactionsRoute = myTeamTab(MY_TEAM_TRANSACTIONS_PATH, TransactionsPage); // #366

// The matchup (#34), for anyone in the league: a team's head-to-head in a gameweek, the manager's
// own in the latest begun unless the address names another.
const matchupRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: MATCHUP_PATH,
  validateSearch: matchupSearchOf,
  component: function MatchupScreen() {
    const { session, matchup } = matchupRoute.useRouteContext();
    const { team, gameweek } = matchupRoute.useSearch();
    return <MatchupRoute session={session} seam={matchup} asked={{ teamId: team, gameweek }} />;
  },
});

// The Premier League section (#49), for anyone in a league: the real competition, the same for all.
const premierLeagueRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: PREMIER_LEAGUE_PATH,
  component: function PremierLeague() {
    return <PremierLeaguePage seam={premierLeagueRoute.useRouteContext({ select: (context) => context.premierLeague })} />;
  },
});

// A real match's page (#45; spec/10, The match page), for anyone in a league, opened from the
// Premier League's fixtures and a player's status on the matchup. A code that isn't a number names no match, so it goes to them.
const matchRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: MATCH_ROUTE,
  beforeLoad: ({ params }) => {
    if (!CODE_DIGITS.test(params.fixtureCode)) throw redirect({ to: PREMIER_LEAGUE_PATH });
  },
  component: function Match() {
    const { session, premierLeague } = matchRoute.useRouteContext();
    const { fixtureCode } = matchRoute.useParams();
    return <MatchRoute session={session} seam={premierLeague} fixtureCode={Number(fixtureCode)} />;
  },
});

const BUILT_PAGES: readonly string[] = [MAIL_PATH, TABLE_PATH, SCOUTING_PATH, HOME_PATH, MY_TEAM_PATH, MY_TEAM_SQUAD_PATH, MY_TEAM_FIXTURES_PATH, MY_TEAM_TRANSACTIONS_PATH, MATCHUP_PATH, PREMIER_LEAGUE_PATH];
const pageRoutes = pages.filter((page) => !BUILT_PAGES.includes(page.path)).map((page) =>
  createRoute({
    getParentRoute: () => frameRoute,
    path: page.path,
    component: () => <PageNotBuilt title={page.label} />,
  }),
);

export const frameChildren = [landingRoute, homeRoute, tableRoute, scoutingRoute, myTeamTacticsRoute, myTeamSquadRoute, myTeamFixturesRoute, myTeamTransactionsRoute, matchupRoute, premierLeagueRoute, matchRoute, ...pageRoutes];
