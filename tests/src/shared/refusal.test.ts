// The live seams' one rule for a failed call (src/shared/refusal.ts): the server's words for a refusal,
// a log and plain words for anything else.

import { ConvexError } from "convex/values";
import { expect, test } from "vitest";
import { silenceConsoleError } from "../../support/console.setup";
import { answerOf, refusalOf } from "../../../src/shared/refusal";

const FAILED = "Something went wrong.";

test("a change made resolves with no problem, and an answer with the answer", async () => {
  expect(await refusalOf(async () => "made", "Making it", FAILED)).toBeNull();
  expect(await answerOf(async () => "Check your email.", "Asking", FAILED)).toBe("Check your email.");
});

test("a refusal resolves with the server's own words, logging nothing", async () => {
  const logged = silenceConsoleError();

  expect(await refusalOf(() => Promise.reject(new ConvexError("Sign in first.")), "Making it", FAILED)).toBe("Sign in first.");
  expect(logged).not.toHaveBeenCalled();
});

test.each([
  ["a thrown error", new Error("offline")],
  ["a refusal with no words", new ConvexError({ code: 1 })],
])("%s is logged as what failed and said plainly", async (_, failure) => {
  const logged = silenceConsoleError();

  expect(await refusalOf(() => Promise.reject(failure), "Making it", FAILED)).toBe(FAILED);
  expect(logged).toHaveBeenCalledWith("Making it failed:", failure);
});
