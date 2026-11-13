// The feedback seam's live wiring, with Convex's query and mutation faked by name: what sending
// asks of the server and resolves with when the server stores it, refuses it, or can't be reached,
// and where the admin's list is read from.

import { renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { expect, test, vi } from "vitest";
import { silenceConsoleError } from "../../support/console.setup";
import type { Id } from "../../../convex/_generated/dataModel";
import { feedbackRefusals } from "../../../convex/feedback/feedback";
import { useLiveFeedback } from "../../../src/feedback/liveFeedback";
import { sendFailedWords } from "../../../src/feedback/words";
import { changeFailedWords } from "../../../src/shared/words";

const convex = vi.hoisted(() => ({ list: vi.fn(), send: vi.fn(), markRead: vi.fn(), remove: vi.fn() }));
vi.mock("convex/react", async () =>
  (await import("../../support/src/convexReact.harness")).fakeConvexReact({
    queries: { "feedback/feedback:list": convex.list },
    mutations: { "feedback/feedback:send": convex.send, "feedback/feedback:markRead": convex.markRead, "feedback/feedback:remove": convex.remove },
  }),
);
const FEEDBACK_ID = "feedback-1" as Id<"feedback">;

const seam = () => renderHook(() => useLiveFeedback()).result.current;

test("sending asks feedback/feedback:send with the message, and resolves with no problem once stored", async () => {
  convex.send.mockResolvedValue(null);
  expect(await seam().send("Hello")).toBeNull();
  expect(convex.send).toHaveBeenCalledWith({ message: "Hello" });
});

test("a refusal resolves with the server's own words", async () => {
  convex.send.mockRejectedValue(new ConvexError(feedbackRefusals.blank));
  expect(await seam().send(" ")).toBe(feedbackRefusals.blank);
});

test("any other failure is logged and said plainly", async () => {
  const consoleError = silenceConsoleError();
  convex.send.mockRejectedValue(new Error("offline"));
  expect(await seam().send("Hello")).toBe(sendFailedWords);
  expect(consoleError).toHaveBeenCalledWith("Sending feedback failed:", expect.any(Error));
});

test("the admin's marking read and deleting ask feedback/feedback:markRead and :remove with the message's id", async () => {
  convex.markRead.mockResolvedValue(null);
  convex.remove.mockResolvedValue(null);
  expect(await seam().markRead(FEEDBACK_ID)).toBeNull();
  expect(convex.markRead).toHaveBeenCalledWith({ feedbackId: FEEDBACK_ID });
  expect(await seam().remove(FEEDBACK_ID)).toBeNull();
  expect(convex.remove).toHaveBeenCalledWith({ feedbackId: FEEDBACK_ID });
});

test("their refusal is the server's own words, and any other failure is logged and said plainly", async () => {
  const consoleError = silenceConsoleError();
  convex.markRead.mockRejectedValue(new ConvexError(feedbackRefusals.gone));
  expect(await seam().markRead(FEEDBACK_ID)).toBe(feedbackRefusals.gone);
  convex.remove.mockRejectedValue(new Error("offline"));
  expect(await seam().remove(FEEDBACK_ID)).toBe(changeFailedWords);
  expect(consoleError).toHaveBeenCalledWith("Deleting feedback failed:", expect.any(Error));
});

test("the admin's list is read from feedback/feedback:list", () => {
  const list = { entries: [], more: false };
  convex.list.mockReturnValue(list);
  expect(renderHook(() => useLiveFeedback().useFeedbackList()).result.current).toBe(list);
  expect(convex.list).toHaveBeenLastCalledWith({});
});
