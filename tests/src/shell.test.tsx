// The shell's routes, rendered (#19's seam): what a visitor and a signed-in manager can reach.

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PRODUCT_NAME } from "../../convex/shared/product";
import type { TopBarState } from "../../src/frame/topBar/topBarState";
import { MAIL_PATH, MY_TEAM_PATH } from "../../src/frame/menu";
import {
  continueLabel,
  continueWords,
  mainMenuLabel,
  menuWords,
  nothingNeedsYouWords,
  sectionTabsLabel,
  signOutWords,
} from "../../src/frame/words";
import { MAIL_TITLE, unreadTabLabel } from "../../src/mail/words";
import { MATCHUP_TITLE } from "../../src/matchup/words";
import { SIGN_IN_PATH } from "../../src/signIn/paths";
import { descriptionOf } from "../support/src/describedBy";
import { LINK_REPLY, league, manager, openApp, visitor } from "../support/src/shell.harness";
import { linkProblemWords, signInWords } from "../../src/signIn/words";

const threeUnreadReason = "3 unread letters";
const threeUnread: TopBarState = { unreadMail: 3, next: { path: MAIL_PATH, reason: threeUnreadReason } };

describe("a logged-out visitor", () => {
  it("opening the app sees the sign-in page: the name, invite only, an email box", async () => {
    const app = openApp("/", visitor);
    expect(await screen.findByRole("heading", { level: 1, name: PRODUCT_NAME })).toBeTruthy();
    expect(screen.getByText(signInWords.inviteOnly)).toBeTruthy();
    expect(screen.getByRole("textbox", { name: signInWords.emailLabel })).toBeTruthy();
    expect(app.path()).toBe(SIGN_IN_PATH);
  });

  it("sees the sign-in panel titled by its plate, with the same email box as every other text box", async () => {
    openApp("/", visitor);
    const panel = await screen.findByRole("region", { name: signInWords.title });
    expect(within(panel).getByRole("heading", { level: 2, name: signInWords.title })).toBeTruthy();
    expect(within(panel).getByRole("textbox", { name: signInWords.emailLabel }).classList.contains("text-box")).toBe(true);
  });

  it.each([MY_TEAM_PATH, "/team/squad", MAIL_PATH, "/leagues", "/leagues/new", "/no-such-page"])(
    "opening %s sees only the sign-in page",
    async (path) => {
      const app = openApp(path, visitor);
      expect(await screen.findByRole("textbox", { name: signInWords.emailLabel })).toBeTruthy();
      expect(screen.queryByRole("navigation")).toBeNull();
      expect(screen.queryByRole("button", { name: signOutWords })).toBeNull();
      expect(app.path()).toBe(SIGN_IN_PATH);
    },
  );

  it("asking for a link asks for it for the email typed, and shows the reply", async () => {
    const app = openApp(SIGN_IN_PATH, visitor);
    await userEvent.type(await screen.findByRole("textbox", { name: signInWords.emailLabel }), "craig@example.com");
    await userEvent.click(screen.getByRole("button", { name: signInWords.send }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(LINK_REPLY));
    expect(app.auth.requestSignInLink).toHaveBeenCalledWith("craig@example.com");
  });

  it("the email box is described by its hint, for screen readers", async () => {
    openApp(SIGN_IN_PATH, visitor);
    expect(descriptionOf(await screen.findByRole("textbox", { name: signInWords.emailLabel }))).toBe(signInWords.hint);
  });

  it("opened from a used or expired link, is told it has expired, above the box to send a new one", async () => {
    openApp(`${SIGN_IN_PATH}?link=expired`, visitor);
    expect((await screen.findByRole("alert")).textContent).toBe(linkProblemWords.expired);
    expect(screen.getByRole("textbox", { name: signInWords.emailLabel })).toBeTruthy();
  });

  it("asking for a new link replaces the expired notice with the reply", async () => {
    openApp(`${SIGN_IN_PATH}?link=expired`, visitor);
    await userEvent.type(await screen.findByRole("textbox", { name: signInWords.emailLabel }), "craig@example.com");
    await userEvent.click(screen.getByRole("button", { name: signInWords.send }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(LINK_REPLY));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([SIGN_IN_PATH, `${SIGN_IN_PATH}?link=nonsense`])("opening %s, with no link problem it knows, sees no notice", async (path) => {
    openApp(path, visitor);
    expect(await screen.findByRole("textbox", { name: signInWords.emailLabel })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("a signed-in manager", () => {
  it("lands on My team, with its tabs under the menu", async () => {
    const app = openApp("/", manager);
    expect(await screen.findByRole("heading", { level: 1, name: league.teamName! })).toBeTruthy();
    expect(app.path()).toBe(MY_TEAM_PATH);
    const main = screen.getByRole("navigation", { name: mainMenuLabel });
    expect(within(main).getByRole("link", { current: "page" }).textContent).toBe(menuWords.myTeam);
    const tabs = screen.getByRole("navigation", { name: sectionTabsLabel });
    expect(within(tabs).getAllByRole("link").map((tab) => tab.textContent)).toEqual([
      menuWords.tactics,
      menuWords.squad,
      menuWords.fixtures,
      menuWords.transactions,
    ]);
    expect(within(tabs).getByRole("link", { current: "page" }).textContent).toBe(menuWords.tactics);
  });

  it("sees the eight sections in the menu, in order", async () => {
    openApp(MY_TEAM_PATH, manager);
    const main = await screen.findByRole("navigation", { name: mainMenuLabel });
    expect(within(main).getAllByRole("link").map((link) => link.textContent)).toEqual([
      menuWords.home,
      menuWords.myTeam,
      menuWords.matchup,
      menuWords.table,
      menuWords.scouting,
      menuWords.trades,
      menuWords.premierLeague,
      MAIL_TITLE,
    ]);
  });

  it("on a section's tab, sees that tab marked, and the section still marked in the menu", async () => {
    // A table's sort or filter in the address must not unmark its tab.
    openApp("/team/squad?sort=form", manager);
    const tabs = await screen.findByRole("navigation", { name: sectionTabsLabel });
    expect(within(tabs).getByRole("link", { current: "page" }).textContent).toBe(menuWords.squad);
    const main = screen.getByRole("navigation", { name: mainMenuLabel });
    expect(within(main).getByRole("link", { current: "page" }).textContent).toBe(menuWords.myTeam);
  });

  it("on a section with no tabs yet, sees no second row", async () => {
    openApp("/matchup", manager);
    expect(await screen.findByRole("heading", { level: 1, name: MATCHUP_TITLE })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: sectionTabsLabel })).toBeNull();
  });

  it("with unread mail, sees Mail's count in the menu, and Continue going to the next thing", async () => {
    openApp(MY_TEAM_PATH, manager, { topBar: threeUnread });
    const mail = await screen.findByRole("link", { name: unreadTabLabel(MAIL_TITLE, 3) });
    expect(mail.getAttribute("href")).toBe(MAIL_PATH);
    expect(within(mail).getByText("3")).toBeTruthy();
    expect(screen.getByRole("link", { name: continueLabel(threeUnreadReason) }).getAttribute("href")).toBe(MAIL_PATH);
  });

  it("with nothing to do, sees 'Nothing needs you' and no Continue, and Mail with no count", async () => {
    openApp(MY_TEAM_PATH, manager);
    expect(await screen.findByText(nothingNeedsYouWords)).toBeTruthy();
    expect(screen.queryByRole("link", { name: new RegExp(`^${continueWords}`) })).toBeNull();
    expect(screen.getByRole("link", { name: MAIL_TITLE }).textContent).toBe(MAIL_TITLE);
  });

  it("opening the sign-in page is sent to My team", async () => {
    const app = openApp(SIGN_IN_PATH, manager);
    expect(await screen.findByRole("heading", { level: 1, name: league.teamName! })).toBeTruthy();
    expect(app.path()).toBe(MY_TEAM_PATH);
  });

  it("signs out from the top bar, and is then sent to the sign-in page", async () => {
    const app = openApp("/team/squad", manager);
    await userEvent.click(await screen.findByRole("button", { name: signOutWords }));
    expect(app.auth.signOut).toHaveBeenCalledOnce();

    app.becomes(visitor);

    expect(await screen.findByRole("textbox", { name: signInWords.emailLabel })).toBeTruthy();
    expect(app.path()).toBe(SIGN_IN_PATH);
  });
});
