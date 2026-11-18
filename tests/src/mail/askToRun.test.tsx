// Asking to be commissioner from Mail (spec/01 S01.2, S01.3; #2661): a commissioner's letter in a
// league with none ends in the ask, and once asked says so.

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MAIL_PATH } from "../../../src/frame/menu";
import { askToRunWords, askedToRunWords } from "../../../src/mail/words";
import { league, manager, openApp } from "../../support/src/shell.harness";
import { letterButton, lettersPanel, mailLetter } from "../../support/src/mailScreen.harness";

const offering = (asked: boolean) => ({ ...mailLetter(1, true, null, "draft"), askToRun: { leagueId: league.leagueId, asked } });

describe("a commissioner's letter in a league with none", () => {
  it("S01.2 ends in Ask to be commissioner, which asks for the letter's league (S01.3)", async () => {
    const app = openApp(MAIL_PATH, manager, { letters: [offering(false)] });
    await lettersPanel();
    await userEvent.click(letterButton("Letter 1"));
    await userEvent.click(screen.getByRole("button", { name: askToRunWords }));
    expect(app.mail.askToBeCommissioner).toHaveBeenCalledExactlyOnceWith(league.leagueId);
  });

  it("S01.3 once asked, says so in place of the button", async () => {
    openApp(MAIL_PATH, manager, { letters: [offering(true)] });
    await lettersPanel();
    await userEvent.click(letterButton("Letter 1"));
    expect(screen.getByText(askedToRunWords)).toBeTruthy();
    expect(screen.queryByRole("button", { name: askToRunWords })).toBeNull();
  });

  it("S01.3 shows why the ask was refused", async () => {
    const app = openApp(MAIL_PATH, manager, { letters: [offering(false)] });
    app.mail.askToBeCommissioner.mockResolvedValueOnce("This league already has a commissioner.");
    await lettersPanel();
    await userEvent.click(letterButton("Letter 1"));
    await userEvent.click(screen.getByRole("button", { name: askToRunWords }));
    expect((await screen.findByRole("alert")).textContent).toBe("This league already has a commissioner.");
  });

  it("S01.2 a letter that doesn't offer it has no button", async () => {
    openApp(MAIL_PATH, manager, { letters: [mailLetter(1, true, null, "draft")] });
    await lettersPanel();
    await userEvent.click(letterButton("Letter 1"));
    expect(screen.queryByRole("button", { name: askToRunWords })).toBeNull();
  });
});
