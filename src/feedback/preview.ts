// Feedback in the preview (src/preview.ts): sending says it's a preview and sends nothing, and the
// admin's Feedback tab lists three made-up messages, one of them long and on several lines.

import type { Id } from "../../convex/_generated/dataModel";
import { HOUR_MS } from "../../convex/shared/time";
import { previewSays } from "../preview";
import type { FeedbackList, FeedbackSeam } from "./seam";

const NEWEST = Date.parse("2026-10-24T21:15:00Z");

const entry = (number: number, hoursAgo: number, from: string, message: string): FeedbackList["entries"][number] => ({
  feedbackId: `preview-feedback-${number}` as Id<"feedback">,
  from,
  at: NEWEST - hoursAgo * HOUR_MS,
  message,
});

const list: FeedbackList = {
  entries: [
    entry(1, 0, "ann@example.com", "The table had us level on points but Bob above me. Is that goal difference or something else?"),
    entry(
      2,
      6,
      "bob@example.com",
      "Squads page on my phone:\n1. Open Squads\n2. Search for Saka\n3. The Assign button sits off the right edge\n\nOtherwise loving it.",
    ),
    entry(3, 30, "cat.with.a.very.long.address@example.com", "Can Mail tell me when my lineup is short before the deadline?"),
  ],
  more: false,
};

export const previewFeedback: FeedbackSeam = {
  send: previewSays("your feedback wasn't sent"),
  useFeedbackList: () => list,
};
