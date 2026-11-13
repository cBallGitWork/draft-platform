// The Mail screen (#26, spec/16; docs/design/approved/mail/): the top bar's league's letters under
// their days, newest first, the one selected open beside them, which marks it read; and All and
// Unread on the plate. Write to the league is writeToLeague.test.tsx.

import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { LETTERS_SHOWN, UNREAD_COUNTED } from "../../../convex/mail/mailLimits";
import { MAIL_PATH } from "../../../src/frame/menu";
import { mainMenuLabel } from "../../../src/frame/words";
import { LEAGUES_PATH } from "../../../src/leagues/paths";
import { LEAGUES_TITLE } from "../../../src/leagues/words";
import { league, manager, newcomer, openApp } from "../../support/src/shell.harness";
import { MAIL_TITLE, fromWords, loadingWords, mailTabWords, mailTabsLabel, noLetterOpenWords, noUnreadWords, unreadFigure, noLettersWords, onlyLatestWords } from "../../../src/mail/words";
import { letter, letterButton, letters, lettersPanel, shown, twoUnread } from "../../support/src/mailScreen.harness";

const tab = (name: string) => within(screen.getByRole("group", { name: mailTabsLabel })).getByRole("button", { name });

describe("the letters", () => {
  it("are listed in the order the server sends them, newest first, dated, with the unread ones marked", async () => {
    openApp(MAIL_PATH, manager, { topBar: twoUnread, letters });
    const rows = within(await lettersPanel()).getAllByRole("button").map((row) => row.textContent);

    expect(rows[0]).toContain("commish@example.com");
    expect(rows[0]).toContain("Unread: ");
    expect(rows[0]).toContain("Letter 3");
    expect(rows[0]).toContain("13:00");
    expect(rows[1]).toContain(`Unread: ${league.name}Letter 2`);
    expect(rows[2]).toContain(`${league.name}Letter 1`);
    expect(rows[2]).not.toContain("Unread");
  });

  it("stand under the day each came, newest day first", async () => {
    const sameDay = { ...letter(2, true), letterId: "letter-2b" as Id<"letters">, subject: "Letter 2b", at: letters[1].at - 60_000 };
    openApp(MAIL_PATH, manager, { letters: [...letters.slice(0, 2), sameDay, letters[2]] });
    const days = within(await lettersPanel()).getAllByRole("heading", { level: 3 }).map((day) => day.textContent);
    expect(days).toEqual(["Tue 13 Oct", "Mon 12 Oct", "Sun 11 Oct"]);
  });

  it("are the top bar's league's, asked for by that league (S16.1); someone in none asks for every one", async () => {
    const app = openApp(MAIL_PATH, manager, { letters });
    await lettersPanel();
    expect(app.mail.useLetters).toHaveBeenLastCalledWith(league.leagueId);
    cleanup();
    const outside = openApp(MAIL_PATH, newcomer, { letters });
    await lettersPanel();
    expect(outside.mail.useLetters).toHaveBeenLastCalledWith(null);
  });

  it("one the address names opens with the page, marked read if it was unread (a screen's Mail widget links there)", async () => {
    const app = openApp(`${MAIL_PATH}?letter=letter-2`, manager, { topBar: twoUnread, letters });
    await lettersPanel();
    expect(shown("The text of letter 2.")).toBe(true);
    expect(shown("The text of letter 3.")).toBe(false);
    expect(app.mail.open).toHaveBeenCalledTimes(1);
    expect(app.mail.open).toHaveBeenCalledWith("letter-2");
  });

  it("one the address names that is already read is opened without asking anything", async () => {
    const app = openApp(`${MAIL_PATH}?letter=letter-1`, manager, { topBar: twoUnread, letters });
    await lettersPanel();
    expect(shown("The text of letter 1.")).toBe(true);
    expect(app.mail.open).not.toHaveBeenCalled();
  });

  it("opening an unread one shows its text and marks it read; opening a read one asks nothing", async () => {
    const app = openApp(MAIL_PATH, manager, { topBar: twoUnread, letters });
    await lettersPanel();
    expect(shown("The text of letter 3.")).toBe(false);
    expect(shown(noLetterOpenWords)).toBe(true);

    await userEvent.click(letterButton("Letter 3"));
    expect(shown("The text of letter 3.")).toBe(true);
    expect(letterButton("Letter 3").getAttribute("aria-current")).toBe("true");
    expect(app.mail.open).toHaveBeenCalledWith("letter-3");

    await userEvent.click(letterButton("Letter 1"));
    expect(shown("The text of letter 1.")).toBe(true);
    expect(shown("The text of letter 3.")).toBe(false);
    expect(letterButton("Letter 3").getAttribute("aria-current")).toBeNull();
    expect(app.mail.open).toHaveBeenCalledTimes(1);
  });

  it("the open one is beside the list, its plate saying who it's from, its subject over its text", async () => {
    openApp(MAIL_PATH, manager, { letters });
    await lettersPanel();
    await userEvent.click(letterButton("Letter 3"));
    const open = screen.getByRole("region", { name: fromWords("commish@example.com") });
    expect(within(open).getByRole("heading", { level: 3 }).textContent).toBe("Letter 3");
    expect(within(open).getByText("The text of letter 3.")).toBeTruthy();
    expect(within(open).getByText("Tue 13 Oct, 13:00")).toBeTruthy();
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
    await lettersPanel();
    expect(screen.queryByText(onlyLatestWords)).toBeNull();
  });
});

describe("All and Unread", () => {
  it("Unread lists only the unread, keeping the one opened there until another is", async () => {
    openApp(MAIL_PATH, manager, { letters });
    await lettersPanel();
    await userEvent.click(tab(mailTabWords(2).unread));
    expect(tab(mailTabWords(2).unread).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: /Letter 1/ })).toBeNull();
    await userEvent.click(letterButton("Letter 3"));
    expect(letterButton("Letter 3")).toBeTruthy();

    await userEvent.click(tab(mailTabWords(2).all));
    expect(letterButton("Letter 1")).toBeTruthy();
  });

  it("Unread with none unread says so", async () => {
    openApp(MAIL_PATH, manager, { letters: [letter(1, true)] });
    await lettersPanel();
    await userEvent.click(tab(mailTabWords(0).unread));
    expect(screen.getByText(noUnreadWords)).toBeTruthy();
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
    await lettersPanel();
    expect(app.mail.useLetters).toHaveBeenCalled();
  });
});

describe("the unread count", () => {
  it("is the same on Mail's plate and in the menu", async () => {
    openApp(MAIL_PATH, manager, { topBar: twoUnread, letters });
    await lettersPanel();
    expect(tab(mailTabWords(2).unread)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Mail, 2 unread" })).toBeTruthy();
  });

  it("sits on the title plate beside the heading, not in it", async () => {
    openApp(MAIL_PATH, manager, { topBar: twoUnread, letters });
    const title = await screen.findByRole("heading", { level: 1, name: MAIL_TITLE });
    expect(screen.getByRole("region", { name: MAIL_TITLE })).toBeTruthy();
    expect(title.parentElement?.contains(tab(mailTabWords(2).unread))).toBe(true);
    expect(title.textContent).toBe(MAIL_TITLE);
  });

  it(`past ${UNREAD_COUNTED}, shows ${UNREAD_COUNTED}+`, async () => {
    const unread = Array.from({ length: UNREAD_COUNTED + 1 }, (_, index) => letter(index + 1, false));
    openApp(MAIL_PATH, manager, { topBar: { unreadMail: UNREAD_COUNTED + 1, next: null }, letters: unread });
    await lettersPanel();
    expect(tab(`Unread (${UNREAD_COUNTED}+)`)).toBeTruthy();
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
