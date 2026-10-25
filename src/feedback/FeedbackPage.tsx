import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { FEEDBACK_MAX } from "../../convex/feedback/feedbackLimits";
import { PANEL_BODY, PageSection, Problem } from "../frame/Panel";
import { useChange } from "../useChange";
import { FEEDBACK_PATH } from "./paths";
import type { FeedbackSeam } from "./seam";
import { FEEDBACK_TITLE, feedbackHint, feedbackLinkWords, messageLabel, sendWords, sentWords } from "./words";

const MESSAGE_ID = "feedback-message";

/** How many lines the box shows before it scrolls. */
const MESSAGE_ROWS = 8;

/** The top bar's Feedback link (spec/12 The frame), on either signed-in frame. */
export function FeedbackLink() {
  return (
    <Link to={FEEDBACK_PATH} className="flex min-h-tap items-center px-4 text-lead">
      {feedbackLinkWords}
    </Link>
  );
}

/** What the Feedback link opens (spec/15 The admin): one text box, sent to the admin's dashboard,
 *  with no email. */
export function FeedbackPage({ send }: { send: FeedbackSeam["send"] }) {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, problem, run } = useChange();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(false);
    if (await run(() => send(message))) {
      setSent(true);
      setMessage("");
    }
  }

  return (
    <PageSection title={FEEDBACK_TITLE} className="max-w-xl bg-panel">
      <Problem problem={problem} />
      {sent && (
        <p role="status" className="px-3 pt-2 text-derived">
          {sentWords}
        </p>
      )}
      <form onSubmit={submit} className={PANEL_BODY}>
        <p className="text-muted">{feedbackHint}</p>
        <label htmlFor={MESSAGE_ID} className="font-semibold">
          {messageLabel}
        </label>
        <textarea
          id={MESSAGE_ID}
          required
          maxLength={FEEDBACK_MAX}
          rows={MESSAGE_ROWS}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="text-box py-1"
        />
        <button type="submit" disabled={busy} className="action self-start">
          {sendWords}
        </button>
      </form>
    </PageSection>
  );
}
