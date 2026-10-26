// The screens' tests' shared setup: the app opened at an address, for a session, with sign-in's,
// leagues', Mail's and joining's actions and a league's gameweeks faked so a test can see what was
// asked of them.

import { createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { LetterSummary } from "../../../convex/mail/mail";
import type { LeagueSummary } from "../../../convex/leagues/myLeagues";
import { fakeAdmin, type AdminData } from "./admin.harness";
import { fakeFeedback, type FeedbackData } from "./feedback.harness";
import type { AuthActions, Session } from "../../../src/auth";
import type { TopBarState } from "../../../src/frame/topBarState";
import { fakeGameweeks } from "./gameweeks.harness";
import { fakeJoining, type JoiningData } from "./joining.harness";
import type { LeaguesSeam } from "../../../src/leagues/seam";
import type { MailSeam } from "../../../src/mail/seam";
import { ShellApp } from "../../../src/ShellApp";
import { fakeLeagueSettings, type LeagueSettingsData } from "./leagueSettings.harness";
import { fakePatches, type PatchesData } from "./patches.harness";
import { fakeMyTeam, type MyTeamData } from "./myTeam.harness";
import { fakePlayerCard, type PlayerCardData } from "./playerCard.harness";
import { fakeScoring, type ScoringData } from "./scoring.harness";
import { fakeSquads, type SquadsData } from "./squads.harness";
import { fakeScouting, type ScoutingData } from "./scouting.harness";
import { fakeHome, type HomeData } from "./home.harness";
import { fakePremierLeague, type PremierLeagueData } from "./premierLeague.harness";
import { fakeTable, type TableData } from "./table.harness";

export const visitor: Session = { signedIn: false };

/** A league as signIn/account:signedInAs sends it, for `manager`, who runs Team 1 in it. */
export const league: LeagueSummary = {
  leagueId: "league-1" as Id<"leagues">,
  name: "Tim Hortons Pro League",
  commissionerEmail: "commish@example.com",
  roles: ["manager"],
  teamName: "Team 1",
  teams: 3,
  maxTeams: 4,
  unsentCommissionerLink: null,
};

/** A second league, which `manager` commissions with no team of their own. */
export const miniBeta: LeagueSummary = {
  ...league,
  leagueId: "league-2" as Id<"leagues">,
  name: "Mini beta",
  roles: ["commissioner"],
  teamName: null,
};

const signedIn = { signedIn: true, email: "manager@example.com", isAdmin: false } as const;
/** A manager in these leagues, the app in the first. */
export const managerIn = (...leagues: LeagueSummary[]) =>
  ({ ...signedIn, inLeague: true, leagues, currentLeagueId: leagues[0].leagueId }) satisfies Session;
export const manager = managerIn(league);
/** The commissioner of `league`, running no team in it. */
export const commissioner = managerIn({ ...league, roles: ["commissioner"], teamName: null });
/** `league` as `manager` sees it when they run it as well as Team 1. */
export const commissioned: LeagueSummary = { ...league, roles: ["commissioner", "manager"] };
/** `league` as its co-commissioner sees it. */
export const coCommissioned: LeagueSummary = { ...league, roles: ["co-commissioner"] };
/** `summary` as someone with no part in its league sees it: no role, no team. */
export const withNoPart = (summary: LeagueSummary): LeagueSummary => ({ ...summary, roles: [], teamName: null });
export const newcomer: Session = { ...signedIn, inLeague: false, leagues: [], currentLeagueId: null };
/** The admin, seeing every league, with no part in any. */
export const adminSeeing = (...leagues: LeagueSummary[]) =>
  ({
    ...signedIn,
    email: "craig@example.com",
    isAdmin: true,
    inLeague: false,
    leagues,
    currentLeagueId: null,
  }) satisfies Session;
export const admin = adminSeeing();

type Deletion = NonNullable<LeagueSummary["deletion"]>;
/** `summary`'s league being deleted (spec/13, Deleting): frozen until `deletesAt`. */
export const beingDeleted = (
  summary: LeagueSummary,
  { deletesAt = Date.parse("2026-10-22T09:00:00Z") }: Partial<Deletion> = {},
): LeagueSummary => ({ ...summary, deletion: { deletesAt } });
/** Whoever is deleting `summary`'s league, as signIn/account:signedInAs has them: it's theirs to
 *  see, and they're in no league. */
export const deleterOf = (summary: LeagueSummary): Session => ({
  ...managerIn(summary),
  inLeague: false,
  currentLeagueId: null,
});

export const LINK_REPLY = "Check your email.";

function fakeAuth() {
  return {
    requestSignInLink: vi.fn<AuthActions["requestSignInLink"]>(async () => LINK_REPLY),
    signOut: vi.fn<AuthActions["signOut"]>(async () => {}),
  };
}

/** Each league action succeeds, unless a test says otherwise. */
const fakeLeagues = () => ({
  createLeague: vi.fn<LeaguesSeam["createLeague"]>(async () => null),
  deleteLeague: vi.fn<LeaguesSeam["deleteLeague"]>(async () => null),
  undoDeletion: vi.fn<LeaguesSeam["undoDeletion"]>(async () => null),
  switchLeague: vi.fn<LeaguesSeam["switchLeague"]>(async () => null),
  leaveLeague: vi.fn<LeaguesSeam["leaveLeague"]>(async () => null),
});

/** Mail holding `letters`, whose letter to the league is sent, unless a test says otherwise;
 *  `loading` keeps the letters still on their way (undefined). A test can see which screens read
 *  the letters through `useLetters`. */
const fakeMail = (letters: readonly LetterSummary[], loading: boolean) => ({
  useLetters: vi.fn<MailSeam["useLetters"]>(() => (loading ? undefined : letters)),
  open: vi.fn<MailSeam["open"]>(async () => {}),
  writeToLeague: vi.fn<MailSeam["writeToLeague"]>(async () => null),
});

/** What a test may set besides the address and the session: each seam's data, and the top bar. */
export type AppSetUp = {
  topBar?: TopBarState;
  letters?: readonly LetterSummary[];
  mailLoading?: boolean;
  joining?: JoiningData;
  squads?: SquadsData;
  scoring?: ScoringData;
  leagueSettings?: LeagueSettingsData;
  table?: TableData;
  scouting?: ScoutingData;
  playerCard?: PlayerCardData;
  home?: HomeData;
  myTeam?: MyTeamData;
  premierLeague?: PremierLeagueData;
  admin?: AdminData;
  feedback?: FeedbackData;
  patches?: PatchesData;
};

/** The app opened at `path` for `session`, set up as `setUp` says: where it is, the fake sign-in,
 *  league, Mail, joining, gameweeks, squads, scoring, league settings, table, scouting, player
 *  card, home, my team, Premier League, admin, feedback and patches seams, and a way to change the session as
 *  signing in or out, or a league changing, would. */
export function openApp(path: string, session: Session, setUp: AppSetUp = {}) {
  const {
    topBar = { unreadMail: 0, next: null },
    letters = [],
    mailLoading = false,
    joining: joiningData = {},
    squads: squadsData = {},
    scoring: scoringData = {},
    leagueSettings: leagueSettingsData = {},
    table: tableData = {},
    scouting: scoutingData = {},
    playerCard: playerCardData = {},
    home: homeData = {},
    myTeam: myTeamData = {},
    premierLeague: premierLeagueData = {},
    admin: adminData = {},
    feedback: feedbackData = {},
    patches: patchesData = {},
  } = setUp;
  const history = createMemoryHistory({ initialEntries: [path] });
  const auth = fakeAuth();
  const leagues = fakeLeagues();
  const mail = fakeMail(letters, mailLoading);
  const joining = fakeJoining(joiningData, LINK_REPLY);
  const gameweeks = fakeGameweeks();
  const squads = fakeSquads(squadsData);
  const scoring = fakeScoring(scoringData);
  const leagueSettings = fakeLeagueSettings(leagueSettingsData);
  const table = fakeTable(tableData);
  const scouting = fakeScouting(scoutingData);
  const playerCard = fakePlayerCard(playerCardData);
  const home = fakeHome(homeData);
  const myTeam = fakeMyTeam(myTeamData);
  const premierLeague = fakePremierLeague(premierLeagueData);
  const admin = fakeAdmin(adminData);
  const feedback = fakeFeedback(feedbackData);
  const patches = fakePatches(patchesData);
  const app = (current: Session) => (
    <ShellApp
      session={current}
      auth={auth}
      leagues={leagues}
      mail={mail}
      joining={joining}
      topBar={topBar}
      gameweeks={gameweeks}
      squads={squads}
      scoring={scoring}
      leagueSettings={leagueSettings}
      table={table}
      scouting={scouting}
      playerCard={playerCard}
      home={home}
      myTeam={myTeam}
      premierLeague={premierLeague}
      admin={admin}
      feedback={feedback}
      patches={patches}
      history={history}
    />
  );
  const view = render(app(session));
  return {
    auth,
    leagues,
    mail,
    gameweeks,
    joining,
    squads,
    scoring,
    leagueSettings,
    table,
    scouting,
    playerCard,
    home,
    myTeam,
    premierLeague,
    admin,
    feedback,
    patches,
    path: () => history.location.pathname,
    search: () => history.location.search,
    becomes: (next: Session) => view.rerender(app(next)),
  };
}
