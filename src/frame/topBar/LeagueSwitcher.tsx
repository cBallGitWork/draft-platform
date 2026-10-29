import { Link } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import type { Session } from "../signIn/seam";
import { ESCAPE_KEY, KEY_DOWN, POINTER_DOWN } from "../shared/browserEvents";
import type { LeaguesSeam } from "../leagues/seam";
import { LEAGUES_PATH } from "../leagues/paths";
import { LEAGUES_TITLE, rolesWords } from "../leagues/words";
import { useChange } from "../shared/useChange";
import { LeaveLeague } from "./LeaveLeague";
import { Problem } from "../ui/Panel";
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
 *  to switch to. A manager's list ends with leaving the league they're in (spec/13, Leaving), so
 *  it opens for a manager in one league too. */
export function LeagueSwitcher({
  session,
  switchLeague,
  leaveLeague,
}: {
  session: Session;
  switchLeague: LeaguesSeam["switchLeague"];
  leaveLeague: LeaguesSeam["leaveLeague"];
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
      if (event.key !== ESCAPE_KEY) return;
      setOpen(false);
      toggle.current?.focus();
    };
    const closeOutside = (event: PointerEvent) => {
      if (!switcher.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener(KEY_DOWN, closeOnEscape);
    document.addEventListener(POINTER_DOWN, closeOutside);
    return () => {
      document.removeEventListener(KEY_DOWN, closeOnEscape);
      document.removeEventListener(POINTER_DOWN, closeOutside);
    };
  }, [open]);

  if (!session.signedIn) return null;
  // The server's list (#207), never judged again here: a league being deleted is frozen, so its
  // commissioner sees it on "Your leagues", never here.
  const theirs = session.leagues.filter((league) => session.switchableLeagueIds.includes(league.leagueId));
  const current = theirs.find((league) => league.leagueId === session.currentLeagueId);
  // signIn/account:signedInAs names one of theirs whenever they have any, and the frame is only theirs then.
  if (!current) throw new Error(`The league the app is in, ${session.currentLeagueId}, isn't one of ${session.email}'s`);

  const teamName = current.teamName;
  if (theirs.length === 1 && teamName === null) {
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
        <svg aria-hidden="true" viewBox="0 0 10 6" className="h-caret-height w-caret-width fill-current">
          <path d="M0 0h10L5 6z" />
        </svg>
      </button>
      {open && (
        <div id={listId} className="absolute top-full left-0 z-10 w-full bg-panel shadow-bevel-panel lg:w-league-list">
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
          {teamName !== null && (
            <LeaveLeague league={current} teamName={teamName} leaveLeague={leaveLeague} onLeft={() => setOpen(false)} />
          )}
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
      <span className="text-muted">{league.teamName ?? rolesWords(league.roles)}</span>
    </button>
  );
}
