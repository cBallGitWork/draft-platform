import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { refusalOf } from "../shared/refusal";
import type { FeedbackSeam } from "./seam";
import { sendFailedWords } from "./words";

const useFeedbackList: FeedbackSeam["useFeedbackList"] = () => useQuery(api.feedback.feedback.list, {});

/** The feedback seam filled in by Convex. A refusal comes back as the server's own words; any other
 *  failure is logged and said plainly. */
export function useLiveFeedback(): FeedbackSeam {
  const send = useMutation(api.feedback.feedback.send);
  return useMemo(
    () => ({
      send: (message) => refusalOf(() => send({ message }), "Sending feedback", sendFailedWords),
      useFeedbackList,
    }),
    [send],
  );
}
