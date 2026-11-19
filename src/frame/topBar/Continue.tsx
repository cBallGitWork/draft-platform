import { Link } from "@tanstack/react-router";
import type { NextStep } from "./topBarState";
import { continueLabel, nothingNeedsYouWords } from "../words";

/** The top bar's button: the next job that needs the manager, named ("3 unread", "Set line-up"),
 *  and going to it; or a plain "Nothing to do". */
export function Continue({ next }: { next: NextStep | null }) {
  if (!next) {
    return (
      <span className="flex min-h-tap items-center border border-muted px-4 text-lead font-semibold text-soft">
        {nothingNeedsYouWords}
      </span>
    );
  }
  return (
    <Link
      to={next.path}
      aria-label={continueLabel(next.job, next.place)}
      className="action"
    >
      {next.job}
    </Link>
  );
}
