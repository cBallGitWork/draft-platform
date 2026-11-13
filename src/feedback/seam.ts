// The seam for feedback to the admin (#357): sending it, and the admin's list of it. Convex fills
// it in live (liveFeedback.ts); the preview and the tests hand the screens their own.

import type { Id } from "../../convex/_generated/dataModel";
import type { FeedbackList } from "../../convex/feedback/feedback";
import type { Change } from "../shared/refusal";

export type { FeedbackList };

export type FeedbackSeam = {
  /** Sends the admin a message from whoever is signed in. */
  send(message: string): Change;
  /** The admin marks a message read (#395). */
  markRead(feedbackId: Id<"feedback">): Change;
  /** The admin deletes a message (#395). */
  remove(feedbackId: Id<"feedback">): Change;
  /** What was sent, newest first, live (a hook), for the admin's dashboard alone: undefined while
   *  it loads. */
  useFeedbackList(): FeedbackList | undefined;
};
