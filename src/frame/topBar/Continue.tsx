import { Link } from "@tanstack/react-router";
import type { NextStep } from "./topBarState";
import { continueLabel, continueWords, nothingNeedsYouWords } from "../words";

/** The top bar's button: to the next thing that needs the manager, or a plain "Nothing needs you". */
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
      aria-label={continueLabel(next.reason)}
      className="action"
    >
      {continueWords}
    </Link>
  );
}
