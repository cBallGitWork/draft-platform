// Mail's live wiring, with Convex's hooks faked by name: the top bar's count and Continue from the
// server's unread count, the letters asked for only by the hook Mail calls (#211), and what opening
// and sending resolve with when the server refuses or can't be reached.

import { renderHook } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { beforeEach, expect, test, vi } from "vitest";
import { silenceConsoleError } from "../../support/console.setup";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { MAIL_PATH } from "../../../src/frame/menu";
import { useLiveMail } from "../../../src/mail/liveMail";
import { sendFailedWords } from "../../../src/mail/words";
import { A_LEAGUE_ID } from "../../support/src/convexReact.harness";

const convex = vi.hoisted(() => ({
  signedIn: true,
  unread: 0 as number | undefined,
  letters: [] as unknown[],
  /** Each query asked for, by name, and "skip" when it was skipped. */
  queried: [] as string[],
  open: vi.fn(),
  write: vi.fn(),
}));
vi.mock("convex/react", async () => {
  /** A query's fake that notes it was asked for, and gives what `answer` reads unless skipped. */
  const noted = (name: string, answer: () => unknown) => (args: unknown) => {
    convex.queried.push(args === "skip" ? "skip" : name);
    return args === "skip" ? undefined : answer();
  };
  return {
    ...(await import("../../support/src/convexReact.harness")).fakeConvexReact({
      queries: {
        "mail/mail:letters": noted("mail/mail:letters", () => convex.letters),
        "mail/mail:unreadCount": noted("mail/mail:unreadCount", () => convex.unread),
      },
      mutations: { "mail/mail:open": convex.open, "mail/mail:writeToLeague": convex.write },
    }),
    useConvexAuth: () => ({ isAuthenticated: convex.signedIn }),
  };
});

beforeEach(() => {
  convex.signedIn = true;
  convex.unread = 0;
  convex.letters = [];
  convex.queried = [];
});

const LETTERS_QUERY = getFunctionName(api.mail.mail.letters);
const UNREAD_QUERY = getFunctionName(api.mail.mail.unreadCount);
const live = () => renderHook(useLiveMail).result.current;
/** The letters as Mail reads them, through the seam's hook. */
const lettersOnMail = () => renderHook(live().mail.useLetters).result.current;
const letter = { leagueId: A_LEAGUE_ID, subject: "Hi", body: "Hello" };

test("unread letters are the top bar's count, and Continue goes to Mail", () => {
  convex.unread = 3;
  expect(live().topBar).toEqual({ unreadMail: 3, next: { path: MAIL_PATH, reason: "3 unread" } });
});

test("with nothing unread, or the count still loading, there is no count and nothing to continue to", () => {
  expect(live().topBar).toEqual({ unreadMail: 0, next: null });
  convex.unread = undefined;
  expect(live().topBar).toEqual({ unreadMail: 0, next: null });
});

test("the shell asks only for the unread count, never the letters", () => {
  live();
  expect(convex.queried).toEqual([UNREAD_QUERY]);
});

test("Mail's hook asks for the letters, and gives them back", () => {
  convex.letters = [{ subject: "Hi" }];
  expect(lettersOnMail()).toBe(convex.letters);
  expect(convex.queried).toContain(LETTERS_QUERY);
});

test("signed out, Mail isn't asked for", () => {
  convex.signedIn = false;
  expect(lettersOnMail()).toBeUndefined();
  expect(convex.queried).toEqual(["skip", "skip"]);
});

test("a letter the server sends resolves with no problem", async () => {
  convex.write.mockResolvedValue(null);
  expect(await live().mail.writeToLeague(letter)).toBeNull();
  expect(convex.write).toHaveBeenCalledWith(letter);
});

test("a letter the server refuses resolves with the server's own words", async () => {
  convex.write.mockRejectedValue(new ConvexError("Give the letter a subject."));
  expect(await live().mail.writeToLeague(letter)).toBe("Give the letter a subject.");
});

test("any other failure to send is logged and said plainly", async () => {
  const failure = new Error("offline");
  convex.write.mockRejectedValue(failure);
  const logged = silenceConsoleError();

  expect(await live().mail.writeToLeague(letter)).toBe(sendFailedWords);
  expect(logged).toHaveBeenCalledWith("Sending a letter to the league failed:", failure);
});

test("a letter that can't be marked read is logged, and opening it doesn't reject", async () => {
  const failure = new Error("offline");
  convex.open.mockRejectedValue(failure);
  const logged = silenceConsoleError();

  await live().mail.open("letter-1" as Id<"letters">);
  expect(convex.open).toHaveBeenCalledWith({ letterId: "letter-1" });
  expect(logged).toHaveBeenCalledWith("Marking a letter read failed:", failure);
});
