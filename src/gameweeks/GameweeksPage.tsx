import { useState } from "react";
import { isLocked } from "../../convex/gameweeks/deadline";
import type { LeagueGameweek } from "../../convex/gameweeks/leagueGameweeks";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { ColumnHeads } from "../ui/ColumnHeads";
import { Loading, PageSection, Problem } from "../ui/Panel";
import { BackToLeagues } from "../leagues/LeagueLinks";
import { TickBox } from "../ui/TickBox";
import { useChange } from "../shared/useChange";
import { useMinute } from "../shared/useMinute";
import { gameweekWords, whenWords } from "../shared/words";
import type { LeagueGameweeksView } from "./seam";
import {
  begunWords,
  gameweekColumns,
  GAMEWEEKS_TITLE,
  howTickingWorks,
  loadingWords,
  noDeadlineWords,
  playsWords,
} from "./words";

const cellClasses = "px-2 text-left align-middle";

/** The commissioner's gameweeks (spec/13, Gameweeks): a tick for each one the league plays, all
 *  38 by default, until it begins. Each tick is sent as it's made; the server says why one wasn't. */
export function GameweeksPage({ league, view }: { league: LeagueSummary; view: LeagueGameweeksView }) {
  const { gameweeks, setUsed } = view;
  /** Which gameweek's tick is waiting on the server; useChange's own busy can't say which row. */
  const [sending, setSending] = useState<number | null>(null);
  const { problem, run } = useChange();

  async function tick({ gameweek, used }: LeagueGameweek) {
    setSending(gameweek);
    await run(() => setUsed(gameweek, !used));
    setSending(null);
  }

  const plays = playsWords(league.name);
  return (
    <PageSection title={GAMEWEEKS_TITLE} className="max-w-3xl bg-panel">
      <div className="flex flex-col gap-2 px-3 py-2">
        {gameweeks && (
          <p className="text-lead">
            {plays.before}
            <span className="text-figure">{gameweeks.filter((each) => each.used).length}</span>
            {plays.after}
          </p>
        )}
        <p className="text-muted">{howTickingWorks}</p>
        <Problem problem={problem} />
        {gameweeks ? (
          <div className="grid gap-2 lg:grid-cols-2">
            {halves(gameweeks).map((rows, index) => (
              <GameweekTable key={index} rows={rows} sending={sending} onTick={tick} />
            ))}
          </div>
        ) : (
          <Loading>{loadingWords}</Loading>
        )}
        <BackToLeagues className="self-start" />
      </div>
    </PageSection>
  );
}

/** A season in two halves, side by side on the desk. */
function halves<T>(rows: readonly T[]): T[][] {
  const half = Math.ceil(rows.length / 2);
  return [rows.slice(0, half), rows.slice(half)];
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
  // Redrawn each minute so a gameweek that begins while the page is open stops taking ticks; judged
  // against the moment itself, not the minute's start, which would leave it tickable up to 59s past.
  useMinute();
  const now = Date.now();
  return (
    <table className="w-full self-start border-collapse">
      <ColumnHeads columns={gameweekColumns} classOf={() => cellClasses} />
      <tbody>
        {rows.map((row) => {
          const begun = isLocked(row.deadline, now);
          return (
            <tr key={row.gameweek} className={`border-t border-panel-rule ${row.used ? "" : "text-muted"}`}>
              <th scope="row" className={`${cellClasses} font-semibold`}>{row.gameweek}</th>
              <DeadlineCell deadline={row.deadline} begun={begun} />
              <td className={cellClasses}>
                <TickBox checked={row.used} disabled={begun || sending === row.gameweek} onChange={() => onTick(row)} labelHidden>
                  {gameweekWords(row.gameweek)}
                </TickBox>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** When the gameweek begins, or, muted, that it has begun or that the app doesn't know when. */
function DeadlineCell({ deadline, begun }: { deadline: number | null; begun: boolean }) {
  if (deadline === null || begun) {
    return <td className={`${cellClasses} text-muted`}>{deadline === null ? noDeadlineWords : begunWords}</td>;
  }
  return <td className={cellClasses}>{whenWords(deadline)}</td>;
}
