// Feedback's tests' fake seam (shell.harness.tsx hands it to the app).

import { vi } from "vitest";
import type { FeedbackList, FeedbackSeam } from "../../../src/feedback/seam";

/** What the fake server holds: the admin's list, and whether it is still on its way. */
export type FeedbackData = { list?: FeedbackList; loading?: boolean };

export const NO_FEEDBACK: FeedbackList = { entries: [], more: false };

/** Sending succeeds, unless a test says otherwise; `loading` keeps the list undefined. */
export function fakeFeedback({ list = NO_FEEDBACK, loading = false }: FeedbackData = {}) {
  return {
    send: vi.fn<FeedbackSeam["send"]>(async () => null),
    useFeedbackList: vi.fn<FeedbackSeam["useFeedbackList"]>(() => (loading ? undefined : list)),
  };
}
