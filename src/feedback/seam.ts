// The seam for feedback to the admin (#357): sending it, and the admin's list of it. Convex fills
// it in live (liveFeedback.ts); the preview and the tests hand the screens their own.

import type { FeedbackList } from "../../convex/feedback/feedback";
import type { Change } from "../refusal";

export type { FeedbackList };

export type FeedbackSeam = {
  /** Sends the admin a message from whoever is signed in. */
  send(message: string): Change;
  /** What was sent, newest first, live (a hook), for the admin's dashboard alone: undefined while
   *  it loads. */
  useFeedbackList(): FeedbackList | undefined;
};
