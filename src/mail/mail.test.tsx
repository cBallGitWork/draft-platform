// The Mail screen (#26, spec/16): the letters newest first, opened in place, which marks them read;
// the unread count; and the commissioner's letter to the whole league.

import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import type { LetterSummary } from "../../convex/mail";
import { LETTERS_SHOWN, UNREAD_COUNTED } from "../../convex/mailLimits";
import { MAIL_PATH } from "../frame/menu";
import { LEAGUES_PATH } from "../leagues/paths";
import { league, manager, managerIn, newcomer, openApp } from "../shell.harness";
import { WRITE_TITLE, loadingWords, noLettersWords, onlyLatestWords, sentWords } from "./words";

afterEach(cleanup);

// Noon UTC, so the day is the same in any time zone the tests run in.
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
const commissioner = managerIn({ ...league, roles: ["commissioner", "manager"] });

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
    openApp(MAIL_PATH, manager, { letters: null });
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

describe("the unread count", () => {
  it("is the same on Mail's plate and in the menu", async () => {
    openApp(MAIL_PATH, manager, { topBar: twoUnread, letters });
    expect(await screen.findByText("2 unread")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Mail, 2 unread" })).toBeTruthy();
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
    expect(screen.queryByRole("navigation", { name: "Main" })).toBeNull();
    await userEvent.click(letterButton("Letter 3"));
    expect(shown("The text of letter 3.")).toBe(true);
    expect(app.mail.open).toHaveBeenCalledWith("letter-3");
  });

  it("opening Mail's address stays on Mail, and the top bar goes back to their leagues", async () => {
    const app = openApp(MAIL_PATH, newcomer, { topBar: twoUnread, letters });
    expect(await screen.findByRole("heading", { level: 1, name: "Mail" })).toBeTruthy();
    expect(app.path()).toBe(MAIL_PATH);

    await userEvent.click(screen.getByRole("link", { name: "Your leagues" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Your leagues" })).toBeTruthy();
    expect(app.path()).toBe(LEAGUES_PATH);
  });
});

describe("writing to the league", () => {
  it("isn't offered to a manager who runs no league", async () => {
    openApp(MAIL_PATH, manager, { topBar: twoUnread, letters });
    await screen.findByRole("list");
    expect(screen.queryByRole("heading", { name: WRITE_TITLE })).toBeNull();
  });

  it("the commissioner sends one to their league, and is told it went", async () => {
    const app = openApp(MAIL_PATH, commissioner, { topBar: twoUnread, letters });
    await userEvent.type(await screen.findByRole("textbox", { name: "Subject" }), "Draft night");
    await userEvent.type(screen.getByRole("textbox", { name: "Letter" }), "Friday at eight.");
    await userEvent.click(screen.getByRole("button", { name: `Send to ${league.name}` }));

    expect(app.mail.writeToLeague).toHaveBeenCalledWith({ leagueId: league.leagueId, subject: "Draft night", body: "Friday at eight." });
    expect((await screen.findByRole("status")).textContent).toBe(sentWords(league.name));
    expect((screen.getByRole("textbox", { name: "Subject" }) as HTMLInputElement).value).toBe("");
  });

  it("a letter the server refuses shows why, and keeps what was typed", async () => {
    const app = openApp(MAIL_PATH, commissioner, { topBar: twoUnread, letters });
    app.mail.writeToLeague.mockResolvedValue("Give the letter a subject.");
    await userEvent.type(await screen.findByRole("textbox", { name: "Subject" }), "x");
    await userEvent.type(screen.getByRole("textbox", { name: "Letter" }), "Hello");
    await userEvent.click(screen.getByRole("button", { name: `Send to ${league.name}` }));

    expect((await screen.findByRole("alert")).textContent).toBe("Give the letter a subject.");
    expect((screen.getByRole("textbox", { name: "Letter" }) as HTMLTextAreaElement).value).toBe("Hello");
  });

  it("someone running two leagues picks which one it goes to", async () => {
    const other = { ...league, leagueId: "league-2" as Id<"leagues">, name: "Mini beta", roles: ["co-commissioner" as const] };
    const app = openApp(MAIL_PATH, managerIn({ ...league, roles: ["commissioner"] }, other), { topBar: twoUnread, letters });
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "League" }), "Mini beta");
    await userEvent.type(screen.getByRole("textbox", { name: "Subject" }), "Hi");
    await userEvent.type(screen.getByRole("textbox", { name: "Letter" }), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send to Mini beta" }));

    expect(app.mail.writeToLeague).toHaveBeenCalledWith({ leagueId: "league-2", subject: "Hi", body: "Hello" });
  });
});
