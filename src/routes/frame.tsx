import type { ComponentType } from "react";
import { createRoute, redirect } from "@tanstack/react-router";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { CurrentLeague } from "./CurrentLeague";
import { DraftPage } from "../draft/DraftPage";
import { DRAFT_PATH, HOME_NEWS_PATH, HOME_PATH, MATCHUP_PATH, MY_TEAM_FIXTURES_PATH, MY_TEAM_PATH, MY_TEAM_SQUAD_PATH, MY_TEAM_TRANSACTIONS_PATH, PREMIER_LEAGUE_PATH, SCOUTING_PATH, TABLE_PATH, TRADES_NEW_PATH, TRADES_PATH } from "../frame/menu";
import { HomePage } from "../home/HomePage";
import { NewsPage } from "../home/NewsPage";
import { recapSearchOf, RECAP_PATH } from "../home/paths";
import { RecapPage } from "../home/Recap";
import { MatchupPage } from "../matchup/MatchupPage";
import { matchupSearchOf } from "../matchup/paths";
import { FixturesPage } from "../myTeam/FixturesPage";
import { SquadPage } from "../myTeam/SquadPage";
import { tacticsSearchOf } from "../myTeam/tactics/paths";
import { TacticsPage } from "../myTeam/tactics/TacticsPage";
import { TransactionsPage } from "../myTeam/TransactionsPage";
import { MatchPage } from "../premierLeague/MatchPage";
import { MATCH_ROUTE } from "../premierLeague/paths";
import { PremierLeaguePage } from "../premierLeague/PremierLeaguePage";
import { ScoutingPage } from "../scouting/ScoutingPage";
import { TablePage } from "../table/TablePage";
import { NewOfferPage } from "../trades/NewOfferPage";
import { OffersPage } from "../trades/OffersPage";
import { newOfferSearchOf, offersSearchOf } from "../trades/paths";
import { CODE_DIGITS, LANDING_PATH, frameRoute, type ShellContext } from "./root";

// The pages under root.tsx's frameRoute, for anyone in a league, in its frame: every menu page but
// Mail, whose route is with the league pages (leaguePages.tsx). Each league page is the current league's (CurrentLeague.tsx),
// so a switch to another league starts it afresh.

// A signed-in manager lands on My team (spec/12).
const landingRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: LANDING_PATH,
  beforeLoad: () => {
    throw redirect({ to: MY_TEAM_PATH });
  },
});

/** The seams of the current league's pages that take only the league and their seam. */
type LeaguePageSeams = Pick<ShellContext, "table" | "home" | "scouting" | "myTeam" | "draft" | "trades">;

/** A page of the current league's at `path`, for anyone in it: `Page` is given the league the app
 *  is in and its seam from the context. */
function leaguePage<Seam extends keyof LeaguePageSeams, Path extends string>(
  path: Path,
  seam: Seam,
  Page: ComponentType<{ league: LeagueSummary; seam: LeaguePageSeams[Seam] }>,
) {
  const route = createRoute({
    getParentRoute: () => frameRoute,
    path,
    component: function LeaguePage() {
      const context = route.useRouteContext();
      return <CurrentLeague session={context.session} page={(league) => <Page league={league} seam={context[seam]} />} />;
    },
  });
  return route;
}

const tableRoute = leaguePage(TABLE_PATH, "table", TablePage); // The league's table and fixtures (#33)
const homeRoute = leaguePage(HOME_PATH, "home", HomePage); // League home (#387)
const homeNewsRoute = leaguePage(HOME_NEWS_PATH, "home", NewsPage); // League home's News tab (#1356)
const scoutingRoute = leaguePage(SCOUTING_PATH, "scouting", ScoutingPage); // Scouting's players list (#373)
// The draft room (#1098): its menu tab leaves once the draft is over, and its address still opens it.
const draftRoute = leaguePage(DRAFT_PATH, "draft", DraftPage);

// My team's Tactics tab (#14), where a manager lands: his own team's lineup on the pitch, with the
// player the address names selected (#1008).
const myTeamTacticsRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: MY_TEAM_PATH,
  validateSearch: tacticsSearchOf,
  component: function Tactics() {
    const { session, myTeam } = myTeamTacticsRoute.useRouteContext();
    const { player } = myTeamTacticsRoute.useSearch();
    return <CurrentLeague session={session} page={(league) => <TacticsPage league={league} seam={myTeam} selected={player} />} />;
  },
});
const myTeamSquadRoute = leaguePage(MY_TEAM_SQUAD_PATH, "myTeam", SquadPage); // #364
const myTeamFixturesRoute = leaguePage(MY_TEAM_FIXTURES_PATH, "myTeam", FixturesPage); // #365
const myTeamTransactionsRoute = leaguePage(MY_TEAM_TRANSACTIONS_PATH, "myTeam", TransactionsPage); // #366

// The matchup (#34), for anyone in the league: a team's head-to-head in a gameweek, the manager's
// own in the latest begun unless the address names another.
const matchupRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: MATCHUP_PATH,
  validateSearch: matchupSearchOf,
  component: function MatchupScreen() {
    const { session, matchup } = matchupRoute.useRouteContext();
    const { team, gameweek, game } = matchupRoute.useSearch();
    return <CurrentLeague session={session} page={(league) => <MatchupPage league={league} seam={matchup} asked={{ teamId: team, gameweek, game }} />} />;
  },
});

// League home's weekly recap, whole (#387), opened by Read the recap. With no gameweek named it is
// League home's to show, so it goes there.
const recapRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: RECAP_PATH,
  validateSearch: recapSearchOf,
  beforeLoad: ({ search }) => {
    if (search.gameweek === undefined) throw redirect({ to: HOME_PATH });
  },
  component: function RecapScreen() {
    const { session, home } = recapRoute.useRouteContext();
    const { gameweek } = recapRoute.useSearch();
    return <CurrentLeague session={session} page={(league) => <RecapPage league={league} seam={home} gameweek={gameweek!} />} />;
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
    const code = Number(fixtureCode);
    return (
      <CurrentLeague
        session={session}
        page={(league) => <MatchPage league={league} seam={premierLeague} fixtureCode={code} />}
        // Keyed by the match as well as the league, so going to another match starts afresh too.
        keyOf={(league) => `${league.leagueId}/${code}`}
      />
    );
  },
});

// Trades (#383; docs/design/approved/trades): the Offers tab, with the offer or trade in review the
// address names selected, as a Mail letter's link opens it; and New offer, which a counter opens
// filled with the offer it answers, and a player card's Offer a trade with him asked for (#1027).
const tradesRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: TRADES_PATH,
  validateSearch: offersSearchOf,
  component: function Offers() {
    const { session, trades } = tradesRoute.useRouteContext();
    const { offer } = tradesRoute.useSearch();
    return <CurrentLeague session={session} page={(league) => <OffersPage league={league} seam={trades} asked={offer} />} />;
  },
});
const newOfferRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: TRADES_NEW_PATH,
  validateSearch: newOfferSearchOf,
  component: function NewOffer() {
    const { session, trades } = newOfferRoute.useRouteContext();
    const { counter, team, player } = newOfferRoute.useSearch();
    return (
      <CurrentLeague session={session} page={(league) => <NewOfferPage league={league} seam={trades} counter={counter} asked={{ team, player }} />} />
    );
  },
});

export const frameChildren = [landingRoute, homeRoute, homeNewsRoute, recapRoute, tableRoute, scoutingRoute, draftRoute, myTeamTacticsRoute, myTeamSquadRoute, myTeamFixturesRoute, myTeamTransactionsRoute, matchupRoute, premierLeagueRoute, matchRoute, tradesRoute, newOfferRoute];