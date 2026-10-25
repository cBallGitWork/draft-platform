// The feedback seam's live wiring, with Convex's query and mutation faked by name: what sending
// asks of the server and resolves with when the server stores it, refuses it, or can't be reached,
// and where the admin's list is read from.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { afterEach, expect, test, vi } from "vitest";
import { silenceConsoleError } from "../../support/console.setup";
import { useLiveFeedback } from "../../../src/feedback/liveFeedback";
import { sendFailedWords } from "../../../src/feedback/words";

const convex = vi.hoisted(() => ({ list: vi.fn(), send: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "feedback/feedback:list": convex.list },
    mutations: { "feedback/feedback:send": convex.send },
  }),
);

afterEach(() => {
  for (const fake of Object.values(convex)) fake.mockReset();
});

const seam = () => renderHook(() => useLiveFeedback()).result.current;

test("sending asks feedback/feedback:send with the message, and resolves with no problem once stored", async () => {
  convex.send.mockResolvedValue(null);
  expect(await seam().send("Hello")).toBeNull();
  expect(convex.send).toHaveBeenCalledWith({ message: "Hello" });
});

test("a refusal resolves with the server's own words", async () => {
  convex.send.mockRejectedValue(new ConvexError("Write something first."));
  expect(await seam().send(" ")).toBe("Write something first.");
});

test("any other failure is logged and said plainly", async () => {
  const consoleError = silenceConsoleError();
  convex.send.mockRejectedValue(new Error("offline"));
  expect(await seam().send("Hello")).toBe(sendFailedWords);
  expect(consoleError).toHaveBeenCalledWith("Sending feedback failed:", expect.any(Error));
});

test("the admin's list is read from feedback/feedback:list", () => {
  const list = { entries: [], more: false };
  convex.list.mockReturnValue(list);
  expect(renderHook(() => useLiveFeedback().useFeedbackList()).result.current).toBe(list);
  expect(convex.list).toHaveBeenLastCalledWith({});
});
