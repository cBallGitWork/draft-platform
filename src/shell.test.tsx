// The shell's routes, rendered (#19's seam): what a visitor and a signed-in manager can reach.

import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { emptyTopBar, type TopBarState } from "./frame/topBarState";
import { MAIL_PATH, MY_TEAM_PATH, sections } from "./frame/menu";
import { previewTopBar } from "./preview";
import { SIGN_IN_PATH, createShellRouter } from "./router";

afterEach(cleanup);
// The router restores scroll on every navigation, and jsdom has no scrolling to restore.
window.scrollTo = () => {};

function openApp(path: string, { signedIn, topBar = emptyTopBar }: { signedIn: boolean; topBar?: TopBarState }) {
  const router = createShellRouter({ signedIn, topBar }, createMemoryHistory({ initialEntries: [path] }));
  render(<RouterProvider router={router} />);
  return router;
}

describe("a logged-out visitor", () => {
  it("opening the app sees the sign-in page: the name, invite only, an email box", async () => {
    const router = openApp("/", { signedIn: false });
    expect(await screen.findByRole("heading", { level: 1, name: "Draft Manager" })).toBeTruthy();
    expect(screen.getByText("Invite only")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Email" })).toBeTruthy();
    expect(router.state.location.pathname).toBe(SIGN_IN_PATH);
  });

  it.each([MY_TEAM_PATH, "/team/squad", MAIL_PATH, "/no-such-page"])("opening %s sees only the sign-in page", async (path) => {
    const router = openApp(path, { signedIn: false });
    expect(await screen.findByRole("textbox", { name: "Email" })).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(router.state.location.pathname).toBe(SIGN_IN_PATH);
  });

  it("asking for a link is told plainly that sign-in isn't switched on", async () => {
    openApp(SIGN_IN_PATH, { signedIn: false });
    await userEvent.type(await screen.findByRole("textbox", { name: "Email" }), "craig@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send the link" }));
    expect((await screen.findByRole("status")).textContent).toBe("Sign-in isn't switched on yet, so no link was sent.");
  });
});

describe("a signed-in manager", () => {
  it("lands on My team, with its tabs under the menu", async () => {
    const router = openApp("/", { signedIn: true });
    expect(await screen.findByRole("heading", { level: 1, name: "My team" })).toBeTruthy();
    expect(router.state.location.pathname).toBe(MY_TEAM_PATH);
    const main = screen.getByRole("navigation", { name: "Main" });
    expect(within(main).getByRole("link", { current: "page" }).textContent).toBe("My team");
    const tabs = screen.getByRole("navigation", { name: "Section" });
    expect(within(tabs).getAllByRole("link").map((tab) => tab.textContent)).toEqual([
      "Tactics",
      "Squad",
      "Fixtures",
      "Transactions",
    ]);
    expect(within(tabs).getByRole("link", { current: "page" }).textContent).toBe("Tactics");
  });

  it("sees every section in the menu", async () => {
    openApp(MY_TEAM_PATH, { signedIn: true });
    const main = await screen.findByRole("navigation", { name: "Main" });
    expect(within(main).getAllByRole("link").map((link) => link.textContent)).toEqual(sections.map((section) => section.label));
  });

  it("on a section's tab, sees that tab marked, and the section still marked in the menu", async () => {
    // A table's sort or filter in the address must not unmark its tab.
    openApp("/team/squad?sort=form", { signedIn: true });
    const tabs = await screen.findByRole("navigation", { name: "Section" });
    expect(within(tabs).getByRole("link", { current: "page" }).textContent).toBe("Squad");
    const main = screen.getByRole("navigation", { name: "Main" });
    expect(within(main).getByRole("link", { current: "page" }).textContent).toBe("My team");
  });

  it("on a section with no tabs yet, sees no second row", async () => {
    openApp("/matchup", { signedIn: true });
    expect(await screen.findByRole("heading", { level: 1, name: "Matchup" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Section" })).toBeNull();
  });

  it("with unread mail, sees Mail's count in the menu, and Continue going to the next thing", async () => {
    openApp(MY_TEAM_PATH, { signedIn: true, topBar: previewTopBar });
    const mail = await screen.findByRole("link", { name: "Mail, 3 unread" });
    expect(mail.getAttribute("href")).toBe(MAIL_PATH);
    expect(within(mail).getByText("3")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Continue: 3 unread letters" }).getAttribute("href")).toBe(MAIL_PATH);
  });

  it("with nothing to do, sees 'Nothing needs you' and no Continue, and Mail with no count", async () => {
    openApp(MY_TEAM_PATH, { signedIn: true });
    expect(await screen.findByText("Nothing needs you")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^Continue/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Mail" }).textContent).toBe("Mail");
  });

  it("opening the sign-in page is sent to My team", async () => {
    const router = openApp(SIGN_IN_PATH, { signedIn: true });
    expect(await screen.findByRole("heading", { level: 1, name: "My team" })).toBeTruthy();
    expect(router.state.location.pathname).toBe(MY_TEAM_PATH);
  });
});
