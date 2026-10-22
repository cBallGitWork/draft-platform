import { Link } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import type { Session } from "../auth";
import type { LeagueActions } from "../leagues/actions";
import { LEAGUES_PATH, LEAGUES_TITLE } from "../leagues/paths";
import { currentLeagueOf } from "../leagues/roles";
import { roleWords } from "../leagues/words";
import { useChange } from "../useChange";
import { Problem } from "./Panel";
import { allLeaguesWords, currentLeagueLabel } from "./words";

// On a phone the league takes its own row under the name, Continue and Sign out, above the menu.
const placementClasses = "order-last w-full border-t border-plate-rule lg:order-none lg:w-auto lg:border-t-0 lg:border-l";
const toggleClasses =
  "flex min-h-tap w-full items-center justify-between gap-2 px-4 text-lead font-semibold hover:bg-stepper aria-expanded:bg-stepper";
const choiceClasses =
  "flex min-h-tap w-full flex-col justify-center px-3 py-1 text-left text-soft hover:text-fact " +
  "aria-current:text-fact aria-current:shadow-current-edge";

/** The top bar's league (spec/13, Several leagues): for someone in several, a list to switch
 *  between them; for someone in one, its name. The admin's leagues he has no part in aren't his
 *  to switch to. */
export function LeagueSwitcher({
  session,
  switchLeague,
}: {
  session: Session;
  switchLeague: LeagueActions["switchLeague"];
}) {
  const [open, setOpen] = useState(false);
  const { busy: switching, problem, run, clear } = useChange();
  const listId = useId();
  const switcher = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  // Escape, or a tap anywhere else, closes the list.
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    const closeOutside = (event: PointerEvent) => {
      if (!switcher.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [open]);

  if (!session.signedIn) return null;
  // A league being deleted is frozen: whoever deleted it sees it on "Your leagues", never here.
  const theirs = session.leagues.filter((league) => league.roles.length > 0 && !league.deletion);
  const current = currentLeagueOf(session);
  // signIn/account:signedInAs names one of theirs whenever they have any, and the frame is only theirs then.
  if (!current || !theirs.includes(current))
    throw new Error(`The league the app is in, ${session.currentLeagueId}, isn't one of ${session.email}'s`);

  if (theirs.length === 1) {
    return <span className={`flex min-h-tap items-center px-4 text-lead font-semibold ${placementClasses}`}>{current.name}</span>;
  }

  const switchTo = async (leagueId: Id<"leagues">) => {
    if (leagueId === current.leagueId || (await run(() => switchLeague(leagueId)))) setOpen(false);
  };

  return (
    <div ref={switcher} className={`relative ${placementClasses}`}>
      <button
        ref={toggle}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          clear();
          setOpen(!open);
        }}
        className={toggleClasses}
      >
        <span>
          <span className="sr-only">{currentLeagueLabel}</span> {current.name}
        </span>
        <svg aria-hidden="true" viewBox="0 0 10 6" className="h-1.5 w-2.5 fill-current">
          <path d="M0 0h10L5 6z" />
        </svg>
      </button>
      {open && (
        <div id={listId} className="absolute top-full left-0 z-10 w-full bg-panel shadow-bevel-panel lg:w-72">
          <Problem problem={problem} />
          <ul aria-label={LEAGUES_TITLE}>
            {theirs.map((league) => (
              <li key={league.leagueId} className="border-b border-panel-rule">
                <LeagueChoice league={league} isCurrent={league === current} disabled={switching} onChoose={switchTo} />
              </li>
            ))}
          </ul>
          <Link to={LEAGUES_PATH} className="flex min-h-tap items-center px-3">
            {allLeaguesWords}
          </Link>
        </div>
      )}
    </div>
  );
}

/** One of the person's leagues, with their team in it, or their part when they run none. */
function LeagueChoice({
  league,
  isCurrent,
  disabled,
  onChoose,
}: {
  league: LeagueSummary;
  isCurrent: boolean;
  disabled: boolean;
  onChoose: (leagueId: Id<"leagues">) => void;
}) {
  return (
    <button
      type="button"
      aria-current={isCurrent || undefined}
      disabled={disabled}
      onClick={() => onChoose(league.leagueId)}
      className={choiceClasses}
    >
      <span className="text-lead font-semibold">{league.name}</span>
      <span className="text-muted">{league.teamName ?? league.roles.map((role) => roleWords[role]).join(", ")}</span>
    </button>
  );
}
