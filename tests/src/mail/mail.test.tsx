// The Mail screen (#26, spec/16): the letters newest first, opened in place, which marks them read;
// the unread count; and the commissioner's letter to the whole league.

import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { LetterSummary } from "../../../convex/mail/mail";
import { LETTERS_SHOWN, UNREAD_COUNTED } from "../../../convex/mail/mailLimits";
import { MAIL_PATH } from "../../../src/frame/menu";
import { mainMenuLabel } from "../../../src/frame/words";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { LEAGUES_TITLE } from "../../../src/leagues/words";
import { adminSeeing, beingDeleted, commissioned, deleterOf, league, manager, managerIn, newcomer, openApp, withNoPart } from "../../support/src/shell.harness";
import { MAIL_TITLE, WRITE_TITLE, loadingWords, unreadFigure, noLettersWords, onlyLatestWords, sendToWords, sentWords, writeHint, writeLabels } from "../../../src/mail/words";
import { descriptionOf } from "../../support/src/describedBy";

// Noon UTC, so a letter's day is the same in London, where vitest.config.ts pins every test's zone.
const letter = (number: number, read: boolean, from: string | null = null): LetterSummary => ({
  letterId: `letter-${number}` as Id<"letters">,
  leagueName: league.name,
  at: Date.UTC(2026, 9, 10 + number, 12),
  from,
  subject: `Letter ${number}`,
  body: `The text of letter ${number}.`,
  read,
});
const letters = [letter(3, false, "commish@example.com"), letter(2, false), letter(1, true)];
const twoUnread = { unreadMail: 2, next: null };

const letterButton = (subject: string) => screen.getByRole("button", { name: new RegExp(subject) });
/** Whether a letter's text is shown: it is hidden until the letter is opened. */
const shown = (text: string) => !screen.getByText(text).hidden;
const commissioner = managerIn(commissioned);

describe("the letters", () => {
  it("are listed in the order the server sends them, newest first, dated, with the unread ones marked", async () => {
    openApp(MAIL_PATH, manager, { topBar: twoUnread, letters });
    const rows = within(await screen.findByRole("list")).getAllByRole("button").map((row) => row.textContent);

    expect(rows[0]).toContain("13 Oct");
    expect(rows[0]).toContain(`Unread: Letter 3${league.name}, from commish@example.com`);
    expect(rows[1]).toContain(`Unread: Letter 2${league.name}`);
    expect(rows[2]).toContain(`Letter 1${league.name}`);
    expect(rows[2]).not.toContain("Unread");
  });

  it("opening an unread one shows its text and marks it read; opening a read one asks nothing", async () => {
    const app = openApp(MAIL_PATH, manager, { topBar: twoUnread, letters });
    await screen.findByRole("list");
    expect(shown("The text of letter 3.")).toBe(false);

    await userEvent.click(letterButton("Letter 3"));
    expect(shown("The text of letter 3.")).toBe(true);
    expect(letterButton("Letter 3").getAttribute("aria-expanded")).toBe("true");
    expect(app.mail.open).toHaveBeenCalledWith("letter-3");

    await userEvent.click(letterButton("Letter 1"));
    expect(shown("The text of letter 1.")).toBe(true);
    expect(shown("The text of letter 3.")).toBe(false);
    expect(app.mail.open).toHaveBeenCalledTimes(1);
  });

  it("with none, says so", async () => {
    openApp(MAIL_PATH, manager);
    expect(await screen.findByText(noLettersWords)).toBeTruthy();
  });

  it("while they load, says that", async () => {
    openApp(MAIL_PATH, manager, { mailLoading: true });
    expect((await screen.findByRole("status")).textContent).toBe(loadingWords);
  });

  it(`at ${LETTERS_SHOWN}, says older ones aren't shown; under it, says nothing`, async () => {
    const full = Array.from({ length: LETTERS_SHOWN }, (_, index) => letter(index + 1, true));
    openApp(MAIL_PATH, manager, { letters: full });
    expect(await screen.findByText(onlyLatestWords)).toBeTruthy();
    cleanup();
    openApp(MAIL_PATH, manager, { letters: full.slice(1) });
    await screen.findByRole("list");
    expect(screen.queryByText(onlyLatestWords)).toBeNull();
  });
});

describe("who reads the letters (#211)", () => {
  it("another screen never asks for them, so a letter filed doesn't re-send them all to it", async () => {
    const app = openApp(LEAGUES_PATH, manager, { topBar: twoUnread, letters });
    expect(await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Mail, 2 unread" })).toBeTruthy();
    expect(app.mail.useLetters).not.toHaveBeenCalled();
  });

  it("Mail asks for them", async () => {
    const app = openApp(MAIL_PATH, manager, { topBar: twoUnread, letters });
    await screen.findByRole("list");
    expect(app.mail.useLetters).toHaveBeenCalled();
  });
});

describe("the unread count", () => {
  it("is the same on Mail's plate and in the menu", async () => {
    openApp(MAIL_PATH, manager, { topBar: twoUnread, letters });
    expect(await screen.findByText("2 unread")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Mail, 2 unread" })).toBeTruthy();
  });

  it("sits on the title plate beside the heading, not in it", async () => {
    openApp(MAIL_PATH, manager, { topBar: twoUnread, letters });
    const title = await screen.findByRole("heading", { level: 1, name: MAIL_TITLE });
    expect(screen.getByRole("region", { name: MAIL_TITLE })).toBeTruthy();
    expect(title.parentElement?.textContent).toBe(`${MAIL_TITLE}2 unread`);
  });

  it(`past ${UNREAD_COUNTED}, shows ${UNREAD_COUNTED}+`, async () => {
    openApp(MAIL_PATH, manager, { topBar: { unreadMail: UNREAD_COUNTED + 1, next: null }, letters });
    expect(await screen.findByText(`${UNREAD_COUNTED}+ unread`)).toBeTruthy();
    expect(screen.getByRole("link", { name: `Mail, ${UNREAD_COUNTED}+ unread` })).toBeTruthy();
  });
});

describe("someone in no league, as a manager removed from their last one is (spec/13)", () => {
  it("sees Mail and its count on the top bar, opens it, and reads a letter", async () => {
    const app = openApp(LEAGUES_PATH, newcomer, { topBar: twoUnread, letters });
    await userEvent.click(await screen.findByRole("link", { name: "Mail, 2 unread" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Mail" })).toBeTruthy();
    expect(app.path()).toBe(MAIL_PATH);
    const main = screen.getByRole("navigation", { name: mainMenuLabel });
    expect(within(main).getAllByRole("link").map((tab) => tab.textContent)).toEqual([LEAGUES_TITLE, `${MAIL_TITLE}${unreadFigure(twoUnread.unreadMail)}`]);
    await userEvent.click(letterButton("Letter 3"));
    expect(shown("The text of letter 3.")).toBe(true);
    expect(app.mail.open).toHaveBeenCalledWith("letter-3");
  });

  it("opening Mail's address stays on Mail, and the top bar goes back to their leagues", async () => {
    const app = openApp(MAIL_PATH, newcomer, { topBar: twoUnread, letters });
    expect(await screen.findByRole("heading", { level: 1, name: "Mail" })).toBeTruthy();
    expect(app.path()).toBe(MAIL_PATH);

    await userEvent.click(screen.getByRole("link", { name: LEAGUES_TITLE }));
    expect(await screen.findByRole("heading", { level: 1, name: LEAGUES_TITLE })).toBeTruthy();
    expect(app.path()).toBe(LEAGUES_PATH);
  });
});

describe("writing to the league", () => {
  it("isn't offered to a manager who runs no league", async () => {
    openApp(MAIL_PATH, manager, { topBar: twoUnread, letters });
    await screen.findByRole("list");
    expect(screen.queryByRole("heading", { name: WRITE_TITLE })).toBeNull();
  });

  it("is a panel titled by its plate", async () => {
    openApp(MAIL_PATH, commissioner, { topBar: twoUnread, letters });
    const panel = await screen.findByRole("region", { name: WRITE_TITLE });
    expect(within(panel).getByRole("heading", { level: 2, name: WRITE_TITLE })).toBeTruthy();
  });

  it("describes the letter's box by the hint, for screen readers", async () => {
    openApp(MAIL_PATH, commissioner, { topBar: twoUnread, letters });
    expect(descriptionOf(await screen.findByRole("textbox", { name: writeLabels.body }))).toBe(writeHint);
  });

  it("the commissioner sends one to their league, and is told it went", async () => {
    const app = openApp(MAIL_PATH, commissioner, { topBar: twoUnread, letters });
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
    const app = openApp(MAIL_PATH, commissioner, { topBar: twoUnread, letters });
    app.mail.writeToLeague.mockResolvedValue("Give the letter a subject.");
    await userEvent.type(await screen.findByRole("textbox", { name: writeLabels.subject }), "x");
    await userEvent.type(screen.getByRole("textbox", { name: writeLabels.body }), "Hello");
    await userEvent.click(screen.getByRole("button", { name: `Send to ${league.name}` }));

    expect((await screen.findByRole("alert")).textContent).toBe("Give the letter a subject.");
    expect((screen.getByRole("textbox", { name: writeLabels.body }) as HTMLTextAreaElement).value).toBe("Hello");
  });

  it("the admin writes from a league he has no part in, which the switcher leaves out (#562)", async () => {
    const app = openApp(MAIL_PATH, adminSeeing(withNoPart(league)), { topBar: twoUnread, letters });
    await userEvent.type(await screen.findByRole("textbox", { name: writeLabels.subject }), "Hi");
    await userEvent.type(screen.getByRole("textbox", { name: writeLabels.body }), "Hello");
    await userEvent.click(screen.getByRole("button", { name: sendToWords(league.name) }));
    expect(app.mail.writeToLeague).toHaveBeenCalledWith({ leagueId: league.leagueId, subject: "Hi", body: "Hello" });
  });

  it.each([
    ["the admin", adminSeeing(beingDeleted(withNoPart(league)))],
    ["its commissioner, deleting it", deleterOf(beingDeleted(commissioned))],
  ])("isn't offered to %s from a league being deleted", async (_, session) => {
    openApp(MAIL_PATH, session, { topBar: twoUnread, letters });
    await screen.findByRole("list");
    expect(screen.queryByRole("heading", { name: WRITE_TITLE })).toBeNull();
  });

  it("someone running two leagues picks which one it goes to", async () => {
    const other = { ...league, leagueId: "league-2" as Id<"leagues">, name: "Mini beta", roles: ["co-commissioner" as const] };
    const app = openApp(MAIL_PATH, managerIn({ ...league, roles: ["commissioner"] }, other), { topBar: twoUnread, letters });
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: writeLabels.league }), "Mini beta");
    await userEvent.type(screen.getByRole("textbox", { name: writeLabels.subject }), "Hi");
    await userEvent.type(screen.getByRole("textbox", { name: writeLabels.body }), "Hello");
    await userEvent.click(screen.getByRole("button", { name: sendToWords("Mini beta") }));

    expect(app.mail.writeToLeague).toHaveBeenCalledWith({ leagueId: "league-2", subject: "Hi", body: "Hello" });
  });
});
