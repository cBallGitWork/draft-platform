// The screens' tests' shared setup: the app opened at an address, for a session, with sign-in's,
// leagues', Mail's and joining's actions and a league's gameweeks faked so a test can see what was
// asked of them.

import { createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { LetterSummary } from "../../../convex/mail/mail";
import { switchableLeagues } from "../../../convex/leagues/lastLeague";
import type { LeagueSummary } from "../../../convex/leagues/myLeagues";
import { fakeAdmin } from "./admin.harness";
import { fakeFeedback } from "./feedback.harness";
import type { AuthActions, Session } from "../../../src/signIn/seam";
import type { TopBarState } from "../../../src/frame/topBarState";
import { fakeGameweeks } from "./gameweeks.harness";
import { fakeJoining, type JoiningData } from "./joining.harness";
import type { LeaguesSeam } from "../../../src/leagues/seam";
import type { MailSeam } from "../../../src/mail/seam";
import { ShellApp } from "../../../src/app/ShellApp";
import { fakeLeagueSettings } from "./leagueSettings.harness";
import { fakePatches } from "./patches.harness";
import { fakeMatchup } from "./matchup.harness";
import { fakeMyTeam } from "./myTeam.harness";
import { fakePlayerCard } from "./playerCard.harness";
import { fakeScoring } from "./scoring.harness";
import { fakeSquads } from "./squads.harness";
import { fakeScouting } from "./scouting.harness";
import { fakeHome } from "./home.harness";
import { fakePremierLeague } from "./premierLeague.harness";
import { fakeTable } from "./table.harness";

export const visitor: Session = { signedIn: false };

/** What a person with these roles may do in a league, as the server's powersIn sends it (pinned
 *  in tests/convex/leagues/myLeagues.test.ts), so a fake league's powers follow its roles. */
function powersOf(roles: LeagueSummary["roles"], admin: boolean): LeagueSummary["powers"] {
  const names = admin || roles.includes("commissioner");
  return { names, runs: names || roles.includes("co-commissioner") };
}
/** `leagues` with the powers the server would send this person in each. */
const withPowers = (leagues: readonly LeagueSummary[], admin: boolean) =>
  leagues.map((summary) => ({ ...summary, powers: powersOf(summary.roles, admin) }));

/** A league as signIn/account:signedInAs sends it, for `manager`, who runs Team 1 in it. */
export const league: LeagueSummary = {
  leagueId: "league-1" as Id<"leagues">,
  name: "Tim Hortons Pro League",
  commissionerEmail: "commish@example.com",
  roles: ["manager"],
  powers: powersOf(["manager"], false),
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
/** Of `leagues`, those the switcher offers, by the server's own rule. */
const switchableIdsOf = (leagues: readonly LeagueSummary[]) => switchableLeagues(leagues).map((each) => each.leagueId);
/** A manager in these leagues, the app in the first. Each league's powers follow its roles. */
export const managerIn = (...leagues: LeagueSummary[]) =>
  ({
    ...signedIn,
    inLeague: true,
    leagues: withPowers(leagues, false),
    switchableLeagueIds: switchableIdsOf(leagues),
    currentLeagueId: leagues[0].leagueId,
  }) satisfies Session;
export const manager = managerIn(league);
/** The commissioner of `league`, running no team in it. */
export const commissioner = managerIn({ ...league, roles: ["commissioner"], teamName: null });
/** `league` as `manager` sees it when they run it as well as Team 1. */
export const commissioned: LeagueSummary = { ...league, roles: ["commissioner", "manager"] };
/** `league` as its co-commissioner sees it. */
export const coCommissioned: LeagueSummary = { ...league, roles: ["co-commissioner"] };
/** `summary` as someone with no part in its league sees it: no role, no team. */
export const withNoPart = (summary: LeagueSummary): LeagueSummary => ({ ...summary, roles: [], teamName: null });
export const newcomer: Session = { ...signedIn, inLeague: false, leagues: [], switchableLeagueIds: [], currentLeagueId: null };
/** The admin, seeing every league, with no part in any, and every power in each. */
export const adminSeeing = (...leagues: LeagueSummary[]) =>
  ({
    ...signedIn,
    email: "craig@example.com",
    isAdmin: true,
    inLeague: false,
    leagues: withPowers(leagues, true),
    switchableLeagueIds: switchableIdsOf(leagues),
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

/** The seams faked straight from a test's data, by the name both the set-up and ShellApp give
 *  them. A new screen's seam that takes only its data goes here and nowhere else. */
const FAKES = {
  squads: fakeSquads,
  scoring: fakeScoring,
  leagueSettings: fakeLeagueSettings,
  table: fakeTable,
  scouting: fakeScouting,
  playerCard: fakePlayerCard,
  home: fakeHome,
  myTeam: fakeMyTeam,
  matchup: fakeMatchup,
  premierLeague: fakePremierLeague,
  admin: fakeAdmin,
  feedback: fakeFeedback,
  patches: fakePatches,
};
type Faked = typeof FAKES;
type FakedSeams = { [K in keyof Faked]: ReturnType<Faked[K]> };

/** Each seam in FAKES faked from `setUp`'s data for it, or its own default when there's none. */
function fakeSeams(setUp: AppSetUp): FakedSeams {
  const fake = <K extends keyof Faked>(key: K) => (FAKES[key] as (data: AppSetUp[K]) => FakedSeams[K])(setUp[key]);
  return Object.fromEntries((Object.keys(FAKES) as (keyof Faked)[]).map((key) => [key, fake(key)])) as FakedSeams;
}

/** What a test may set besides the address and the session: each seam's data, and the top bar. */
export type AppSetUp = {
  topBar?: TopBarState;
  letters?: readonly LetterSummary[];
  mailLoading?: boolean;
  joining?: JoiningData;
} & { [K in keyof Faked]?: Parameters<Faked[K]>[0] };

/** The app opened at `path` for `session`, set up as `setUp` says: where it is, the fake sign-in,
 *  league, Mail, joining and gameweeks seams and each seam in FAKES, and a way to change the
 *  session as signing in or out, or a league changing, would. */
export function openApp(path: string, session: Session, setUp: AppSetUp = {}) {
  const { topBar = { unreadMail: 0, next: null }, letters = [], mailLoading = false, joining: joiningData = {} } = setUp;
  const history = createMemoryHistory({ initialEntries: [path] });
  const auth = fakeAuth();
  const leagues = fakeLeagues();
  const mail = fakeMail(letters, mailLoading);
  const joining = fakeJoining(joiningData, LINK_REPLY);
  const gameweeks = fakeGameweeks();
  const seams = fakeSeams(setUp);
  const app = (current: Session) => (
    <ShellApp
      session={current}
      auth={auth}
      leagues={leagues}
      mail={mail}
      joining={joining}
      topBar={topBar}
      gameweeks={gameweeks}
      {...seams}
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
    ...seams,
    path: () => history.location.pathname,
    search: () => history.location.search,
    becomes: (next: Session) => view.rerender(app(next)),
  };
}
