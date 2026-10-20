// A league's invite link, opened (#73 story 3; spec/02, spec/13 Joining): signed out it goes
// through sign-in and back; signed in it asks to join and shows the request waiting.

import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { joinPath, linkOffWords } from "../../convex/joiningShared";
import { SIGN_IN_PATH } from "../router";
import { LINK_REPLY, newcomer, openApp, visitor } from "../shell.harness";
import type { JoinPageData } from "./seam";
import { joinPageWords, signInToJoinWords } from "./words";

afterEach(cleanup);

const TOKEN = "the-token";
const LEAGUE = "Tim Hortons Pro League";
const openLink = (joinPage: JoinPageData, session = newcomer) => openApp(joinPath(TOKEN), session, undefined, { joinPage });

describe("a signed-out visitor opening the invite link", () => {
  it("is sent to sign in, which says the link brings them back to ask to join", async () => {
    const app = openLink({ leagueName: LEAGUE, standing: "mayAsk" }, visitor);
    expect(await screen.findByText(signInToJoinWords)).toBeTruthy();
    expect(app.path()).toBe(SIGN_IN_PATH);
    expect(new URLSearchParams(app.search()).get("join")).toBe(TOKEN);
  });

  it("asks for a sign-in link that leads back to the invite link, and is told the reply", async () => {
    const app = openLink({ leagueName: LEAGUE, standing: "mayAsk" }, visitor);
    await userEvent.type(await screen.findByRole("textbox", { name: "Email" }), "ann@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send the link" }));

    expect((await screen.findByRole("status")).textContent).toBe(LINK_REPLY);
    expect(app.joining.signInToJoin).toHaveBeenCalledWith(TOKEN, "ann@example.com");
    expect(app.auth.requestSignInLink).not.toHaveBeenCalled();
  });

  it("once signed in, is back at the invite link", async () => {
    const app = openLink({ leagueName: LEAGUE, standing: "mayAsk" }, visitor);
    await screen.findByText(signInToJoinWords);
    app.becomes(newcomer);
    expect(await screen.findByRole("button", { name: "Ask to join" })).toBeTruthy();
    expect(app.path()).toBe(joinPath(TOKEN));
  });

  it("opening the plain sign-in page sees no word of joining", async () => {
    openApp(SIGN_IN_PATH, visitor);
    await screen.findByRole("textbox", { name: "Email" });
    expect(screen.queryByText(signInToJoinWords)).toBeNull();
  });
});

describe("someone signed in opening the invite link", () => {
  it("sees the league and asks to join", async () => {
    const app = openLink({ leagueName: LEAGUE, standing: "mayAsk" });
    expect(await screen.findByRole("heading", { level: 1, name: LEAGUE })).toBeTruthy();
    expect(screen.getByText(joinPageWords.mayAsk(LEAGUE))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Ask to join" }));
    expect(app.joining.askToJoin).toHaveBeenCalledWith(TOKEN);
  });

  it("is told why asking was refused", async () => {
    const app = openLink({ leagueName: LEAGUE, standing: "mayAsk" });
    app.joining.askToJoin.mockResolvedValue(linkOffWords);
    await userEvent.click(await screen.findByRole("button", { name: "Ask to join" }));
    expect((await screen.findByRole("alert")).textContent).toBe(linkOffWords);
  });

  it("having asked, sees the request waiting for the commissioner", async () => {
    openLink({ leagueName: LEAGUE, standing: "waiting" });
    expect((await screen.findByRole("status")).textContent).toBe(joinPageWords.waiting(LEAGUE));
    expect(screen.queryByRole("button", { name: "Ask to join" })).toBeNull();
  });

  it("already in the league, is told their team", async () => {
    openLink({ leagueName: LEAGUE, standing: "inLeague", teamName: "Team 3" });
    expect(await screen.findByText(joinPageWords.inLeague(LEAGUE, "Team 3"))).toBeTruthy();
  });

  it("once it was replaced or switched off, is told it no longer works", async () => {
    openLink(null);
    expect(await screen.findByText(linkOffWords)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ask to join" })).toBeNull();
  });

  it("on the sign-in page with the invite link's token, is sent back to the invite link", async () => {
    const app = openApp(`${SIGN_IN_PATH}?join=${TOKEN}`, newcomer, undefined, { joinPage: { leagueName: LEAGUE, standing: "mayAsk" } });
    expect(await screen.findByRole("button", { name: "Ask to join" })).toBeTruthy();
    expect(app.path()).toBe(joinPath(TOKEN));
  });
});
