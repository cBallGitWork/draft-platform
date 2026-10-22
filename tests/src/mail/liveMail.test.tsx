// Mail's live wiring, with Convex faked: the top bar's count and Continue from the server's
// unread count, and what opening and sending resolve with when the server refuses or can't be reached.

import { renderHook } from "@testing-library/react";
import { getFunctionName, type FunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { silenceConsoleError } from "../../support/console.setup";
import type { Id } from "../../../convex/_generated/dataModel";
import { MAIL_PATH } from "../../../src/frame/menu";
import { useLiveMail } from "../../../src/mail/liveMail";
import { sendFailedWords } from "../../../src/mail/words";

const convex = vi.hoisted(() => ({
  signedIn: true,
  unread: 0 as number | undefined,
  queried: [] as unknown[],
  mutate: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: convex.signedIn }),
  useQuery: (query: FunctionReference<"query">, args: unknown) => {
    convex.queried.push(args);
    if (args === "skip") return undefined;
    return getFunctionName(query) === "mail/mail:letters" ? [] : convex.unread;
  },
  useMutation: () => convex.mutate,
}));

beforeEach(() => {
  convex.signedIn = true;
  convex.unread = 0;
  convex.queried = [];
});
afterEach(() => {
  convex.mutate.mockReset();
});

const live = () => renderHook(useLiveMail).result.current;
const letter = { leagueId: "league-1" as Id<"leagues">, subject: "Hi", body: "Hello" };

test("unread letters are the top bar's count, and Continue goes to Mail", () => {
  convex.unread = 3;
  expect(live().topBar).toEqual({ unreadMail: 3, next: { path: MAIL_PATH, reason: "3 unread" } });
});

test("with nothing unread, or the count still loading, there is no count and nothing to continue to", () => {
  expect(live().topBar).toEqual({ unreadMail: 0, next: null });
  convex.unread = undefined;
  expect(live().topBar).toEqual({ unreadMail: 0, next: null });
});

test("signed out, Mail isn't asked for", () => {
  convex.signedIn = false;
  expect(live().mail.letters).toBeUndefined();
  expect(convex.queried).toEqual(["skip", "skip"]);
});

test("a letter the server sends resolves with no problem", async () => {
  convex.mutate.mockResolvedValue(null);
  expect(await live().mail.writeToLeague(letter)).toBeNull();
  expect(convex.mutate).toHaveBeenCalledWith(letter);
});

test("a letter the server refuses resolves with the server's own words", async () => {
  convex.mutate.mockRejectedValue(new ConvexError("Give the letter a subject."));
  expect(await live().mail.writeToLeague(letter)).toBe("Give the letter a subject.");
});

test("any other failure to send is logged and said plainly", async () => {
  const failure = new Error("offline");
  convex.mutate.mockRejectedValue(failure);
  const logged = silenceConsoleError();

  expect(await live().mail.writeToLeague(letter)).toBe(sendFailedWords);
  expect(logged).toHaveBeenCalledWith("Sending a letter to the league failed:", failure);
});

test("a letter that can't be marked read is logged, and opening it doesn't reject", async () => {
  const failure = new Error("offline");
  convex.mutate.mockRejectedValue(failure);
  const logged = silenceConsoleError();

  await live().mail.open("letter-1" as Id<"letters">);
  expect(convex.mutate).toHaveBeenCalledWith({ letterId: "letter-1" });
  expect(logged).toHaveBeenCalledWith("Marking a letter read failed:", failure);
});
