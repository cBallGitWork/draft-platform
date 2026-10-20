import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { isLocked } from "../../convex/deadline";
import type { LeagueGameweek } from "../../convex/leagueGameweeks";
import type { LeagueSummary } from "../../convex/myLeagues";
import { LEAGUES_PATH } from "../leagues/paths";
import type { LeagueGameweeksView } from "./seam";
import {
  begunWords,
  deadlineWords,
  GAMEWEEKS_TITLE,
  howTickingWorks,
  loadingWords,
  noDeadlineWords,
  playsWords,
  tickLabel,
} from "./words";

const cellClasses = "px-2 text-left align-middle";

/** The commissioner's gameweeks (spec/13, Gameweeks): a tick for each one the league plays, all
 *  38 by default, until it begins. Each tick is sent as it's made; the server says why one wasn't. */
export function GameweeksPage({ league, view }: { league: LeagueSummary; view: LeagueGameweeksView }) {
  const { gameweeks, setUsed } = view;
  const [sending, setSending] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function tick({ gameweek, used }: LeagueGameweek) {
    setSending(gameweek);
    setProblem(await setUsed(gameweek, !used));
    setSending(null);
  }

  // A season in two halves, side by side on the desk.
  const half = gameweeks && Math.ceil(gameweeks.length / 2);
  const plays = playsWords(league.name);
  return (
    <section aria-labelledby="page-title" className="max-w-3xl bg-panel">
      <h1 id="page-title" className="bg-plate px-4 py-1 text-title font-bold shadow-bevel-plate">
        {GAMEWEEKS_TITLE}
      </h1>
      <div className="flex flex-col gap-2 px-3 py-2">
        {gameweeks && (
          <p className="text-lead">
            {plays.before}
            <span className="text-figure">{gameweeks.filter((each) => each.used).length}</span>
            {plays.after}
          </p>
        )}
        <p className="text-muted">{howTickingWorks}</p>
        {problem && (
          <p role="alert" className="alert-strip">
            {problem}
          </p>
        )}
        {gameweeks ? (
          <div className="grid gap-2 lg:grid-cols-2">
            {[gameweeks.slice(0, half), gameweeks.slice(half)].map((rows) => (
              <GameweekTable key={rows[0]?.gameweek} rows={rows} sending={sending} onTick={tick} />
            ))}
          </div>
        ) : (
          <p role="status" className="text-muted">
            {loadingWords}
          </p>
        )}
        <Link to={LEAGUES_PATH} className="flex min-h-tap items-center self-start">
          Back to your leagues
        </Link>
      </div>
    </section>
  );
}

function GameweekTable({
  rows,
  sending,
  onTick,
}: {
  rows: readonly LeagueGameweek[];
  sending: number | null;
  onTick: (gameweek: LeagueGameweek) => void;
}) {
  const now = Date.now();
  return (
    <table className="w-full self-start border-collapse">
      <thead className="bg-head text-ground">
        <tr>
          <th scope="col" className={cellClasses}>GW</th>
          <th scope="col" className={cellClasses}>Deadline</th>
          <th scope="col" className={cellClasses}>Plays</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const begun = isLocked(row.deadline, now);
          return (
            <tr key={row.gameweek} className={`border-t border-panel-rule ${row.used ? "" : "text-muted"}`}>
              <th scope="row" className={`${cellClasses} font-semibold`}>{row.gameweek}</th>
              <td className={`${cellClasses} ${row.deadline === null || begun ? "text-muted" : ""}`}>
                {row.deadline === null ? noDeadlineWords : begun ? begunWords : deadlineWords(row.deadline)}
              </td>
              <td className={cellClasses}>
                <TickBox
                  label={tickLabel(row.gameweek)}
                  ticked={row.used}
                  disabled={begun || sending === row.gameweek}
                  onTick={() => onTick(row)}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** A square tick box, CM's, with the whole cell's height to tap. */
function TickBox({ label, ticked, disabled, onTick }: { label: string; ticked: boolean; disabled: boolean; onTick: () => void }) {
  const box = disabled ? (ticked ? "border-muted bg-muted" : "border-muted") : ticked ? "border-fact bg-fact" : "border-soft bg-ground";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={ticked}
      aria-label={label}
      disabled={disabled}
      onClick={onTick}
      className="group flex min-h-tap items-center px-2 lg:min-h-0"
    >
      <span aria-hidden="true" className={`flex size-4 items-center justify-center border ${box}`}>
        {ticked && (
          <svg viewBox="0 0 16 16" className="size-3 stroke-ground" fill="none" strokeWidth="3">
            <path d="M2 8.5 6 12.5 14 3.5" />
          </svg>
        )}
      </span>
    </button>
  );
}
