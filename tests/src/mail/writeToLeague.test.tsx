// Mail's Write to the league (spec/16; docs/design/approved/mail/): the commissioner's one-way
// letter to the whole league, opened from the plate in the right-hand panel.

import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { MAIL_PATH } from "../../../src/frame/menu";
import { adminSeeing, beingDeleted, commissioned, deleterOf, league, manager, managerIn, openApp, withNoPart } from "../../support/src/shell.harness";
import { WRITE_TITLE, leaguesCutFromWords, sendToWords, sentWords, writeHint, writeLabels } from "../../../src/mail/words";
import { descriptionOf } from "../../support/src/describedBy";
import { letterButton, lettersPanel, letterShown, mailLetters, startWriting, twoUnread } from "../../support/src/mailScreen.harness";

/** The commissioner of `league`, running a team in it too. */
const managingCommissioner = managerIn(commissioned);

describe("writing to the league", () => {
  it("isn't offered to a manager who runs no league", async () => {
    openApp(MAIL_PATH, manager, { topBar: twoUnread, letters: mailLetters });
    await lettersPanel();
    expect(screen.queryByRole("button", { name: WRITE_TITLE })).toBeNull();
  });

  it("is a panel titled by its plate", async () => {
    openApp(MAIL_PATH, managingCommissioner, { topBar: twoUnread, letters: mailLetters });
    await startWriting();
    const panel = await screen.findByRole("region", { name: WRITE_TITLE });
    expect(within(panel).getByRole("heading", { level: 2, name: WRITE_TITLE })).toBeTruthy();
  });

  it("opens from the plate in place of the open letter, which selecting a letter brings back", async () => {
    openApp(`${MAIL_PATH}?letter=letter-2`, managingCommissioner, { letters: mailLetters });
    await lettersPanel();
    await startWriting();
    expect(letterShown("The text of letter 2.")).toBe(false);
    expect(screen.getByRole("button", { name: WRITE_TITLE }).getAttribute("aria-pressed")).toBe("true");

    await userEvent.click(letterButton("Letter 2"));
    expect(letterShown("The text of letter 2.")).toBe(true);
    expect(screen.queryByRole("region", { name: WRITE_TITLE })).toBeNull();
  });

  it("says a league they run may be missing when their leagues stop short (#297), and not otherwise", async () => {
    openApp(MAIL_PATH, { ...managingCommissioner, leaguesCut: true }, { topBar: twoUnread, letters: mailLetters });
    await startWriting();
    const panel = await screen.findByRole("region", { name: WRITE_TITLE });
    expect(within(panel).getByText(leaguesCutFromWords)).toBeTruthy();
    cleanup();

    openApp(MAIL_PATH, managingCommissioner, { topBar: twoUnread, letters: mailLetters });
    await startWriting();
    await screen.findByRole("region", { name: WRITE_TITLE });
    expect(screen.queryByText(leaguesCutFromWords)).toBeNull();
  });

  it("describes the letter's box by the hint, for screen readers", async () => {
    openApp(MAIL_PATH, managingCommissioner, { topBar: twoUnread, letters: mailLetters });
    await startWriting();
    expect(descriptionOf(await screen.findByRole("textbox", { name: writeLabels.body }))).toBe(writeHint);
  });

  it("the commissioner sends one to their league, and is told it went", async () => {
    const app = openApp(MAIL_PATH, managingCommissioner, { topBar: twoUnread, letters: mailLetters });
    await startWriting();
    await userEvent.type(await screen.findByRole("textbox", { name: writeLabels.subject }), "Draft night");
    await userEvent.type(screen.getByRole("textbox", { name: writeLabels.body }), "Friday at eight.");
    const statusesBefore = screen.getAllByRole("status");
    await userEvent.click(screen.getByRole("button", { name: `Send to ${league.name}` }));

    expect(app.mail.writeToLeague).toHaveBeenCalledWith({ leagueId: league.leagueId, subject: "Draft night", body: "Friday at eight." });
    const sent = await screen.findByText(sentWords(league.name));
    expect(sent.getAttribute("role")).toBe("status");
    // The live region was in the page, empty, before the send, so the words are announced.
    expect(statusesBefore).toContain(sent);
    expect((screen.getByRole("textbox", { name: writeLabels.subject }) as HTMLInputElement).value).toBe("");
  });

  it("a letter the server refuses shows why, and keeps what was typed", async () => {
    const app = openApp(MAIL_PATH, managingCommissioner, { topBar: twoUnread, letters: mailLetters });
    app.mail.writeToLeague.mockResolvedValue("Give the letter a subject.");
    await startWriting();
    await userEvent.type(await screen.findByRole("textbox", { name: writeLabels.subject }), "x");
    await userEvent.type(screen.getByRole("textbox", { name: writeLabels.body }), "Hello");
    await userEvent.click(screen.getByRole("button", { name: `Send to ${league.name}` }));

    expect((await screen.findByRole("alert")).textContent).toBe("Give the letter a subject.");
    expect((screen.getByRole("textbox", { name: writeLabels.body }) as HTMLTextAreaElement).value).toBe("Hello");
  });

  it("the admin writes from a league he has no part in, which the switcher leaves out (#562)", async () => {
    const app = openApp(MAIL_PATH, adminSeeing(withNoPart(league)), { topBar: twoUnread, letters: mailLetters });
    await startWriting();
    await userEvent.type(await screen.findByRole("textbox", { name: writeLabels.subject }), "Hi");
    await userEvent.type(screen.getByRole("textbox", { name: writeLabels.body }), "Hello");
    await userEvent.click(screen.getByRole("button", { name: sendToWords(league.name) }));
    expect(app.mail.writeToLeague).toHaveBeenCalledWith({ leagueId: league.leagueId, subject: "Hi", body: "Hello" });
  });

  it.each([
    ["the admin", adminSeeing(beingDeleted(withNoPart(league)))],
    ["its commissioner, deleting it", deleterOf(beingDeleted(commissioned))],
  ])("isn't offered to %s from a league being deleted", async (_, session) => {
    openApp(MAIL_PATH, session, { topBar: twoUnread, letters: mailLetters });
    await lettersPanel();
    expect(screen.queryByRole("button", { name: WRITE_TITLE })).toBeNull();
  });

  it("someone running two leagues picks which one it goes to", async () => {
    const other = { ...league, leagueId: "league-2" as Id<"leagues">, name: "Mini beta", roles: ["co-commissioner" as const] };
    const app = openApp(MAIL_PATH, managerIn({ ...league, roles: ["commissioner"] }, other), { topBar: twoUnread, letters: mailLetters });
    await startWriting();
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: writeLabels.league }), "Mini beta");
    await userEvent.type(screen.getByRole("textbox", { name: writeLabels.subject }), "Hi");
    await userEvent.type(screen.getByRole("textbox", { name: writeLabels.body }), "Hello");
    await userEvent.click(screen.getByRole("button", { name: sendToWords("Mini beta") }));

    expect(app.mail.writeToLeague).toHaveBeenCalledWith({ leagueId: "league-2", subject: "Hi", body: "Hello" });
  });
});
