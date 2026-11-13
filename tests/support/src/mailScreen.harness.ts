// The Mail screen's tests' letters and steps (tests/src/mail/).

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "../../../convex/_generated/dataModel";
import type { LetterSummary } from "../../../convex/mail/mail";
import { LETTERS_TITLE, WRITE_TITLE } from "../../../src/mail/words";
import { league } from "./shell.harness";

/** A letter in `league`. Noon UTC, so its day is the same in London, where vitest.config.ts pins
 *  every test's zone. */
export const mailLetter = (number: number, read: boolean, from: string | null = null): LetterSummary => ({
  letterId: `letter-${number}` as Id<"letters">,
  leagueName: league.name,
  at: Date.UTC(2026, 9, 10 + number, 12),
  from,
  subject: `Letter ${number}`,
  body: `The text of letter ${number}.`,
  read,
});
export const mailLetters = [mailLetter(3, false, "commish@example.com"), mailLetter(2, false), mailLetter(1, true)];
export const twoUnread = { unreadMail: 2, next: null };

/** The Letters panel, once the letters are in. */
export const lettersPanel = () => screen.findByRole("region", { name: LETTERS_TITLE });
export const letterButton = (subject: string) => screen.getByRole("button", { name: new RegExp(subject) });
/** Whether a letter's text is shown: only the open letter's is. */
export const letterShown =(text: string) => screen.queryByText(text) !== null;

/** Opens the letter to write to the league, from the plate. */
export async function startWriting() {
  await userEvent.click(await screen.findByRole("button", { name: WRITE_TITLE }));
}
