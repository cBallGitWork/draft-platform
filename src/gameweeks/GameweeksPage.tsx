import { useState } from "react";
import { isLocked } from "../../convex/gameweeks/deadline";
import type { LeagueGameweek } from "../../convex/gameweeks/leagueGameweeks";
import type { LeagueSummary } from "../../convex/leagues/myLeagues";
import { Loading, PageSection, Problem } from "../frame/Panel";
import { BackToLeagues } from "../leagues/LeagueLinks";
import { TickBox } from "../rules/TickBox";
import { gameweekWords, whenWords } from "../words";
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
  const [sending, setSending] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function tick({ gameweek, used }: LeagueGameweek) {
    setSending(gameweek);
    setProblem(await setUsed(gameweek, !used));
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
  const now = Date.now();
  return (
    <table className="w-full self-start border-collapse">
      <thead className="bg-head text-ground">
        <tr>
          <th scope="col" className={cellClasses}>{gameweekColumns.gameweek}</th>
          <th scope="col" className={cellClasses}>{gameweekColumns.deadline}</th>
          <th scope="col" className={cellClasses}>{gameweekColumns.plays}</th>
        </tr>
      </thead>
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
