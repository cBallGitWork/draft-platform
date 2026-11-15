// The regression catalogue's screens-and-routes cases at the Integration and Unit levels (#2305):
// where an address sends each kind of person (docs/design/flow.md's dashed arrows), and the menu
// and top bar each frame shows. Each test's name carries its case ID and the spec or flow line it
// checks. The E2E cases are in tests/smoke/screensAndRoutes.spec.ts.

import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PRODUCT_NAME } from "../../../convex/shared/product";
import { FEEDBACK_PATH } from "../../../src/feedback/paths";
import { feedbackLinkWords } from "../../../src/feedback/words";
import { DRAFT_PATH, MAIL_PATH, MY_TEAM_PATH, TABLE_PATH, TRADES_PATH } from "../../../src/frame/menu";
import { continueWords, currentLeagueLabel, mainMenuLabel, nothingNeedsYouWords, signOutWords } from "../../../src/frame/words";
import { gameweeksPath } from "../../../src/gameweeks/paths";
import { GAMEWEEKS_TITLE } from "../../../src/gameweeks/words";
import { invitesPath } from "../../../src/joining/paths";
import { INVITES_TITLE } from "../../../src/joining/words";
import { settingsPath } from "../../../src/leagueSettings/paths";
import { SETTINGS_TITLE } from "../../../src/leagueSettings/words";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { LEAGUES_TITLE } from "../../../src/leagues/words";
import { MAIL_TITLE, unreadTabLabel } from "../../../src/mail/words";
import { matchPath } from "../../../src/premierLeague/paths";
import { SIGN_IN_PATH } from "../../../src/signIn/paths";
import { signInWords } from "../../../src/signIn/words";
import { squadsPath } from "../../../src/squads/paths";
import { SQUADS_TITLE } from "../../../src/squads/words";
import type { Session } from "../../../src/signIn/seam";
import {
  adminSeeing,
  coCommissioned,
  commissioner,
  expectSentToLeagues,
  league,
  manager,
  managerIn,
  miniBeta,
  newcomer,
  openApp,
  visitor,
  withNoPart,
  yourLeaguesHeading,
} from "../../support/src/shell.harness";

const L1 = league.leagueId;
/** The admin, with no part in L1 and no team anywhere (?preview=admin's standing). */
const adminWithNoPart = adminSeeing(withNoPart(league));

/** Opens each of `paths` for `session` and expects to land on Your leagues. */
async function expectEachSentToLeagues(paths: string[], session: Session) {
  for (const path of paths) {
    await expectSentToLeagues(path, session);
    cleanup();
  }
}

/** Opens `path` for `session` and expects its page, titled `title`, to stay open at that address. */
async function expectOpens(path: string, title: string, session: Session) {
  const app = openApp(path, session);
  expect(await screen.findByRole("heading", { level: 1, name: title })).toBeTruthy();
  expect(app.path()).toBe(path);
  cleanup();
}

describe("an unknown address (flow.md:21, the not-found arrow)", () => {
  it("UI-035 (flow.md:21, spec/12 The frame): a visitor opening /no-such-page is sent on to the sign-in page, never a blank page", async () => {
    const app = openApp("/no-such-page", visitor);
    expect(await screen.findByRole("textbox", { name: signInWords.emailLabel })).toBeTruthy();
    expect(app.path()).toBe(SIGN_IN_PATH);
  });

  it("UI-036 (flow.md:21, spec/12 The frame): a manager in a league opening /leagues/abc/xyz/nothing lands on My team", async () => {
    const app = openApp("/leagues/abc/xyz/nothing", manager);
    expect(await screen.findByRole("heading", { level: 1, name: league.teamName! })).toBeTruthy();
    expect(app.path()).toBe(MY_TEAM_PATH);
  });
});

describe("the league frame's guards (flow.md:91-92, spec/12 The frame)", () => {
  it.each([MY_TEAM_PATH, TABLE_PATH, DRAFT_PATH, TRADES_PATH, matchPath(12345)])(
    "UI-041 (flow.md:91, spec/12 The frame): a visitor opening %s is sent to sign in, and nothing of a league shows",
    async (path) => {
      const app = openApp(path, visitor);
      expect(await screen.findByRole("textbox", { name: signInWords.emailLabel })).toBeTruthy();
      expect(app.path()).toBe(SIGN_IN_PATH);
      expect(screen.queryByRole("navigation")).toBeNull();
      expect(screen.queryByText(league.name)).toBeNull();
    },
  );

  it("UI-042 (flow.md:92): someone in no league opening /team, /table or /draft is sent to Your leagues", async () => {
    await expectEachSentToLeagues([MY_TEAM_PATH, TABLE_PATH, DRAFT_PATH], newcomer);
  });

  it("UI-043 (flow.md:186): the admin, managing no team, opening /team or /table is sent to Your leagues", async () => {
    await expectEachSentToLeagues([MY_TEAM_PATH, TABLE_PATH], adminWithNoPart);
  });
});

describe("a league's own pages (flow.md:38-41, 52)", () => {
  const runnersPages: [string, string][] = [
    [settingsPath(L1), SETTINGS_TITLE],
    [gameweeksPath(L1), GAMEWEEKS_TITLE],
    [squadsPath(L1), SQUADS_TITLE],
    [invitesPath(L1), INVITES_TITLE],
  ];

  it("UI-047 (spec/13 Setting up a league: a co-commissioner runs it): L1's co-commissioner opens its settings, gameweeks, squads and invites", async () => {
    for (const [path, title] of runnersPages) await expectOpens(path, title, managerIn(coCommissioned));
  });

  it("UI-048 (flow.md:38-41): the admin, with no part in L1, opens its settings and squads", async () => {
    await expectOpens(settingsPath(L1), SETTINGS_TITLE, adminWithNoPart);
    await expectOpens(squadsPath(L1), SQUADS_TITLE, adminWithNoPart);
  });

  it("UI-049 (flow.md:52): L1's commissioner opening another league's settings, or a made-up league's, is sent to Your leagues", async () => {
    expect(commissioner.leagues.map((each) => each.leagueId)).not.toContain(miniBeta.leagueId);
    await expectEachSentToLeagues([settingsPath(miniBeta.leagueId), settingsPath("not-an-id")], commissioner);
  });
});

describe("the menu and the top bar (spec/12 The frame, spec/16)", () => {
  it("UI-083 (spec/16: an unread count in the menu): no unread letters show Mail with no count", async () => {
    openApp(MY_TEAM_PATH, manager, { topBar: { unreadMail: 0, next: null } });
    expect((await screen.findByRole("link", { name: MAIL_TITLE })).textContent).toBe(MAIL_TITLE);
  });

  // The cap past 99 ("99+") is the code's choice, not a spec answer (mailLimits.ts), so it isn't
  // asserted here: #2305 says so.
  it.each([1, 99])("UI-083 (spec/16: an unread count in the menu): %i unread letters show that count on Mail", async (unread) => {
    openApp(MY_TEAM_PATH, manager, { topBar: { unreadMail: unread, next: null } });
    const mail = await screen.findByRole("link", { name: unreadTabLabel(MAIL_TITLE, unread) });
    expect(mail.textContent).toBe(`${MAIL_TITLE}${unread}`);
  });

  it("UI-085 (flow.md:107-109, spec/13 Several leagues): someone in no league sees the name, Your leagues, Mail and its count, Feedback and Sign out, and nothing of a league", async () => {
    openApp(LEAGUES_PATH, newcomer, { topBar: { unreadMail: 1, next: null } });
    await yourLeaguesHeading();
    const bar = screen.getByRole("banner");
    expect(within(bar).getByText(PRODUCT_NAME)).toBeTruthy();
    expect(within(bar).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([LEAGUES_PATH, MAIL_PATH, FEEDBACK_PATH]);
    expect(within(bar).getByRole("link", { name: unreadTabLabel(MAIL_TITLE, 1) })).toBeTruthy();
    expect(within(bar).getAllByRole("button").map((button) => button.textContent)).toEqual([signOutWords]);
    expect(within(screen.getByRole("navigation", { name: mainMenuLabel })).getAllByRole("link").map((link) => link.textContent)).toEqual([
      LEAGUES_TITLE,
      `${MAIL_TITLE}1`,
    ]);
    expect(within(bar).queryByText(new RegExp(`^(${continueWords}|${nothingNeedsYouWords}|${currentLeagueLabel})`))).toBeNull();
  });

  it.each([
    ["a manager on Table", TABLE_PATH, manager],
    ["someone in no league on Your leagues", LEAGUES_PATH, newcomer],
  ])("UI-089 (flow.md:110, spec/12 The frame: a Feedback link in the top bar): %s clicking Feedback lands on /feedback", async (_, path, session) => {
    const app = openApp(path, session);
    await userEvent.click(await screen.findByRole("link", { name: feedbackLinkWords }));
    expect(app.path()).toBe(FEEDBACK_PATH);
  });
});
